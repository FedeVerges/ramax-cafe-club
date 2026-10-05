import { join } from "node:path";
import type { RecoveryJob } from "../../../packages/contracts/src";
import { Pool } from "pg";
import {
  readJson,
  maintenancePath,
  clearMaintenance,
  backupDir,
  writeJson,
} from "./modules/backups/backup-files";
// Manual rollback after a power failure during a database swap. Run with API and worker stopped.
async function main() {
  if (process.argv[2] !== "--rollback-interrupted")
    throw new Error("Usá --rollback-interrupted con los servicios detenidos.");
  const marker = await readJson<{
    jobId: string;
    live: string;
    previous: string;
    temp: string;
  }>(maintenancePath());
  const url = new URL(
    process.env.RECOVERY_DATABASE_URL ?? process.env.DATABASE_URL!,
  );
  if (decodeURIComponent(url.pathname.slice(1)) !== marker.live)
    throw new Error(
      "La configuración no corresponde a la restauración interrumpida.",
    );
  url.pathname = "/postgres";
  const pool = new Pool({ connectionString: url.toString() });
  const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
  try {
    const databases = await pool.query(
      "SELECT datname FROM pg_database WHERE datname = ANY($1)",
      [[marker.live, marker.previous, marker.temp]],
    );
    const names = databases.rows.map((r) => r.datname as string);
    if (names.includes(marker.previous)) {
      if (names.includes(marker.live)) {
        await pool.query(
          `ALTER DATABASE ${quote(marker.live)} WITH ALLOW_CONNECTIONS false`,
        );
        await pool.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
          [marker.live],
        );
        const failed = `${marker.temp}_failed_${Date.now()}`;
        await pool.query(
          `ALTER DATABASE ${quote(marker.live)} RENAME TO ${quote(failed)}`,
        );
      }
      await pool.query(
        `ALTER DATABASE ${quote(marker.previous)} RENAME TO ${quote(marker.live)}`,
      );
    } else if (!names.includes(marker.live))
      throw new Error(
        "No se encontró la base original. Se conserva el modo mantenimiento.",
      );
    await pool.query(
      `ALTER DATABASE ${quote(marker.live)} WITH ALLOW_CONNECTIONS true`,
    );
    const restoredUrl = new URL(url);
    restoredUrl.pathname = `/${marker.live}`;
    const check = new Pool({ connectionString: restoredUrl.toString() });
    try {
      await check.query("SELECT sale_number FROM sales LIMIT 1");
      await check.query("UPDATE sessions SET revoked_at = now()");
    } finally {
      await check.end();
    }
    const jobPath = join(backupDir(), `${marker.jobId}.job.json`);
    const job = await readJson<RecoveryJob>(jobPath);
    await writeJson(jobPath, {
      ...job,
      status: "failed",
      error:
        "Restauración interrumpida; se recuperó la base anterior por consola.",
    });
    await clearMaintenance();
    console.log(
      "Base original recuperada. Iniciá los servicios y verificá /api/v1/health.",
    );
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    "No se pudo recuperar la base. Se conservaron los datos para revisión manual.",
  );
  process.exitCode = 1;
});
