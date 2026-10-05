import "reflect-metadata";
import { Pool } from "pg";
import { prepareBackupDir } from "./modules/backups/backup-files";
import { workerTick } from "./modules/backups/backup-engine";
async function main() {
  await prepareBackupDir();
  const url = new URL(
    process.env.RECOVERY_DATABASE_URL ?? process.env.DATABASE_URL!,
  );
  url.pathname = "/postgres";
  const pool = new Pool({ connectionString: url.toString() });
  const lock = await pool.connect();
  lock.on("error", () => process.exit(1));
  const result = await lock.query(
    "SELECT pg_try_advisory_lock(714998) AS acquired",
  );
  if (!result.rows[0].acquired) {
    lock.release();
    await pool.end();
    return;
  }
  try {
    for (;;) {
      try {
        await workerTick();
      } catch {
        console.error(
          "Falló el ciclo de copias. Revisá los servicios locales.",
        );
      }
      await new Promise((r) => setTimeout(r, 60000));
    }
  } finally {
    lock.release();
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    "No se pudo iniciar recuperación. Revisá PostgreSQL y la carpeta de copias.",
  );
  process.exitCode = 1;
});
