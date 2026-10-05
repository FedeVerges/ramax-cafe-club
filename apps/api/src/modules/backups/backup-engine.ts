import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { unlink, readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { matchesMigrationHistory } from "../../database/migration-history";
import type {
  BackupInfo,
  RecoveryJob,
} from "../../../../../packages/contracts/src";
import {
  backupDir,
  businessDay,
  clearMaintenance,
  inMaintenance,
  listBackups,
  listJobs,
  maintenancePath,
  prepareBackupDir,
  readJson,
  projectRoot,
  schemaVersion,
  writeJson,
} from "./backup-files";
const exec = promisify(execFile);
const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;
function connection(database?: string) {
  const url = new URL(
    process.env.RECOVERY_DATABASE_URL ?? process.env.DATABASE_URL!,
  );
  if (database) url.pathname = `/${database}`;
  return url;
}
function databaseName() {
  return decodeURIComponent(connection().pathname.slice(1));
}
function pool(database?: string) {
  return new Pool({ connectionString: connection(database).toString() });
}
async function pgTool(tool: string, args: string[], database: string) {
  const url = connection(database);
  await exec(
    process.env.PG_BIN_DIR
      ? join(
          process.env.PG_BIN_DIR,
          process.platform === "win32" ? `${tool}.exe` : tool,
        )
      : tool,
    args,
    {
      env: {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port || "5432",
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: database,
      },
      timeout: 600000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
}
async function fingerprint(file: string) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}
async function validateDatabase(database: string) {
  const db = pool(database);
  try {
    await db.query("SELECT 1 FROM users LIMIT 1");
    const result = await db.query(
      `SELECT (SELECT count(*) FROM inventory_balances WHERE quantity < 0) + (SELECT count(*) FROM sales s LEFT JOIN payments p ON p.sale_id = s.id WHERE p.id IS NULL OR p.amount_ars <> s.total_ars) AS invalid`,
    );
    if (Number(result.rows[0].invalid))
      throw new Error("Invalid operational data");
    const admin = await db.query(
      "SELECT 1 FROM users WHERE staff_role = 'admin' AND active LIMIT 1",
    );
    if (!admin.rowCount) throw new Error("Backup has no active administrator");
    const journal = await db.query(
      "SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at",
    );
    const { readdir } = await import("node:fs/promises");
    const dir =
      process.env.MIGRATIONS_DIR ?? join(projectRoot(), "db/migrations");
    const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
    const expected = await Promise.all(
      names.map(async (n) =>
        createHash("sha256")
          .update(await readFile(join(dir, n)))
          .digest("hex"),
      ),
    );
    if (!matchesMigrationHistory(journal.rows.map((r) => r.hash), expected))
      throw new Error("Incompatible schema");
  } finally {
    await db.end();
  }
}
async function restoreTemporary(file: string, name: string, admin: Pool) {
  await admin.query(`CREATE DATABASE ${quoted(name)}`);
  await pgTool(
    "pg_restore",
    [
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      name,
      file,
    ],
    name,
  );
  await validateDatabase(name);
}
async function disconnect(admin: Pool | PoolClient, name: string) {
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [name],
  );
}
async function drop(admin: Pool, name: string) {
  await disconnect(admin, name);
  await admin.query(`DROP DATABASE IF EXISTS ${quoted(name)}`);
}

export async function createBackup(): Promise<BackupInfo> {
  await prepareBackupDir();
  const id = randomUUID();
  const file = join(backupDir(), `${id}.dump`);
  const temp = `ramax_verify_${id.replaceAll("-", "")}`;
  const entry: BackupInfo & { sha256?: string } = {
    id,
    createdAt: new Date().toISOString(),
    status: "failed",
    schemaVersion: await schemaVersion(),
  };
  const admin = pool("postgres");
  try {
    await pgTool(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-privileges", "--file", file],
      databaseName(),
    );
    await restoreTemporary(file, temp, admin);
    entry.sha256 = await fingerprint(file);
    entry.status = "valid";
  } catch {
    entry.error =
      "La copia no pudo crearse o validarse. Revisá PostgreSQL, espacio y permisos del servicio.";
  } finally {
    await drop(admin, temp).catch(() => undefined);
    await admin.end();
  }
  await writeJson(join(backupDir(), `${id}.backup.json`), entry);
  if (entry.status === "valid") {
    const cutoff = Date.now() - 30 * 86400000;
    for (const old of await listBackups())
      if (Date.parse(old.createdAt) < cutoff) {
        await unlink(join(backupDir(), `${old.id}.dump`)).catch(
          () => undefined,
        );
        await unlink(join(backupDir(), `${old.id}.backup.json`));
      }
  }
  return entry;
}

export async function restoreBackup(job: RecoveryJob): Promise<void> {
  const path = join(backupDir(), `${job.id}.job.json`);
  const live = databaseName();
  const temp = `ramax_restore_${job.id.slice(0, 24)}`;
  const previous = `ramax_previous_${job.id.slice(0, 24)}`;
  const admin = pool("postgres");
  let swapped = false;
  let originalRenamed = false;
  let liveDisabled = false;
  try {
    const entry = await readJson<BackupInfo & { sha256: string }>(
      join(backupDir(), `${job.backupId}.backup.json`),
    );
    const file = join(backupDir(), `${job.backupId}.dump`);
    if (
      entry.status !== "valid" ||
      entry.schemaVersion !== (await schemaVersion()) ||
      entry.sha256 !== (await fingerprint(file))
    )
      throw new Error("Invalid backup");
    job.status = "running";
    await writeJson(path, job);
    await writeJson(maintenancePath(), {
      jobId: job.id,
      live,
      temp,
      previous,
      phase: "validating",
    });
    await restoreTemporary(file, temp, admin);
    // Drain mutations already admitted before maintenance. New ones reject after acquiring the shared lock.
    const livePool = pool();
    const lock = await livePool.connect();
    try {
      await lock.query("SELECT pg_advisory_lock(714999)");
    } finally {
      lock.release();
      await livePool.end();
    }
    await writeJson(maintenancePath(), {
      jobId: job.id,
      live,
      temp,
      previous,
      phase: "swapping",
    });
    await admin.query(
      `ALTER DATABASE ${quoted(live)} WITH ALLOW_CONNECTIONS false`,
    );
    liveDisabled = true;
    await disconnect(admin, live);
    await admin.query(
      `ALTER DATABASE ${quoted(live)} RENAME TO ${quoted(previous)}`,
    );
    originalRenamed = true;
    await admin.query(
      `ALTER DATABASE ${quoted(temp)} RENAME TO ${quoted(live)}`,
    );
    swapped = true;
    const restored = pool();
    try {
      await restored.query("UPDATE sessions SET revoked_at = now()");
    } finally {
      await restored.end();
    }
    await validateDatabase(live);
    // Readiness confirms API reconnection to the restored database before success is published.
    const health =
      process.env.RECOVERY_HEALTH_URL ?? "http://127.0.0.1:3000/api/v1/health";
    let healthy = false;
    for (let n = 0; n < 15; n++) {
      try {
        const response = await fetch(health, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          healthy = true;
          break;
        }
      } catch {
        /* retry after pool reconnect */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!healthy) throw new Error("API not ready");
    job.status = "succeeded";
    await writeJson(path, job);
    await clearMaintenance();
  } catch {
    job.status = "failed";
    job.error =
      "La restauración falló. Consultá el procedimiento de recuperación local.";
    if (originalRenamed) {
      try {
        if (swapped) {
          await admin.query(
            `ALTER DATABASE ${quoted(live)} WITH ALLOW_CONNECTIONS false`,
          );
          await disconnect(admin, live);
          await admin.query(
            `ALTER DATABASE ${quoted(live)} RENAME TO ${quoted(temp)}`,
          );
        }
        await admin.query(
          `ALTER DATABASE ${quoted(previous)} RENAME TO ${quoted(live)}`,
        );
        await admin.query(
          `ALTER DATABASE ${quoted(live)} WITH ALLOW_CONNECTIONS true`,
        );
        await validateDatabase(live);
        if (inMaintenance()) await clearMaintenance();
      } catch {
        /* Keep maintenance marker; never expose an unverified database. */
      }
    } else {
      try {
        if (liveDisabled)
          await admin.query(
            `ALTER DATABASE ${quoted(live)} WITH ALLOW_CONNECTIONS true`,
          );
        if (inMaintenance()) await clearMaintenance();
      } catch {
        /* Keep maintenance until the original database is reachable. */
      }
    }
  } finally {
    try {
      await writeJson(path, job);
    } finally {
      await admin.end();
    }
  }
}

export async function workerTick() {
  if (inMaintenance()) return; // Interrupted restores require explicit recovery, never an automatic overwrite.
  const operational = pool();
  try {
    await operational.query(
      "UPDATE idempotency_keys SET response = NULL WHERE expires_at <= now() AND response IS NOT NULL",
    );
  } finally {
    await operational.end();
  }
  const jobs = await listJobs();
  for (const job of jobs.filter((j) => j.status === "running")) {
    await writeJson(join(backupDir(), `${job.id}.job.json`), {
      ...job,
      status: "failed",
      error: "El proceso se interrumpió antes de iniciar el reemplazo.",
    });
  }
  const pending = jobs.find((j) => j.status === "pending");
  if (pending) {
    await restoreBackup(pending);
    return;
  }
  const backups = await listBackups();
  if (
    !backups.some(
      (b) =>
        b.status === "valid" &&
        businessDay(new Date(b.createdAt)) === businessDay(),
    )
  ) {
    const last = backups[0];
    if (!last || Date.now() - Date.parse(last.createdAt) > 3600000)
      await createBackup();
  }
}
