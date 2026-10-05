import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { Pool } from "pg";
import type { RecoveryJob } from "../../../packages/contracts/src";
import {
  backupDir,
  inMaintenance,
  listJobs,
  prepareBackupDir,
  writeJson,
} from "./modules/backups/backup-files";
import { restoreBackup } from "./modules/backups/backup-engine";
async function main() {
  const value = (flag: string) => process.argv[process.argv.indexOf(flag) + 1];
  const backupId = value("--backup");
  const actorId = value("--actor");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (
    !process.argv.includes("--confirm") ||
    !backupId ||
    !actorId ||
    !uuid.test(backupId) ||
    !uuid.test(actorId)
  )
    throw new Error("Indicá --backup UUID --actor UUID --confirm.");
  if (
    inMaintenance() ||
    (await listJobs()).some((j) => ["pending", "running"].includes(j.status))
  )
    throw new Error("Ya hay una restauración en curso.");
  const url = new URL(
    process.env.RECOVERY_DATABASE_URL ?? process.env.DATABASE_URL!,
  );
  const databaseUrl = url.toString();
  url.pathname = "/postgres";
  const control = new Pool({ connectionString: url.toString() });
  const lock = await control.connect();
  try {
    const acquired = await lock.query(
      "SELECT pg_try_advisory_lock(714998) AS acquired",
    );
    if (!acquired.rows[0].acquired)
      throw new Error("Detené Ramax-recovery antes de restaurar por consola.");
    const db = new Pool({ connectionString: databaseUrl });
    try {
      const actor = await db.query(
        "SELECT 1 FROM users WHERE id=$1 AND staff_role='admin' AND active",
        [actorId],
      );
      if (!actor.rowCount)
        throw new Error("El responsable debe ser un administrador activo.");
    } finally {
      await db.end();
    }
    await prepareBackupDir();
    const job: RecoveryJob = {
      id: randomBytes(32).toString("hex"),
      backupId,
      actorId,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    await writeJson(join(backupDir(), `${job.id}.job.json`), job);
    await restoreBackup(job);
    console.log(`Restauración ${job.id}: ${job.status}`);
    if (job.status !== "succeeded") process.exitCode = 1;
  } finally {
    lock.release();
    await control.end();
  }
}
void main().catch(() => {
  console.error(
    "No se pudo iniciar la restauración. Revisá parámetros, administrador, base y servicios detenidos.",
  );
  process.exitCode = 1;
});
