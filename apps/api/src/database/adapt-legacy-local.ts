import type { Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { LEGACY_LOCAL_HASHES } from "./migration-history";

// Operación explícita de mantenimiento. Nunca se ejecuta durante el arranque.
export async function adaptLegacyLocal(pool: Pool, migrationsFolder: string): Promise<void> {
  const migrations = readMigrationFiles({ migrationsFolder });
  const migration = migrations[2];
  if (migrations.length !== 3 || !migration) throw new Error("La adaptación requiere las tres migraciones E0/E1.");
  const expected = [...migrations.slice(0, 2).map((m) => m.hash), ...LEGACY_LOCAL_HASHES];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE drizzle.__drizzle_migrations IN ACCESS EXCLUSIVE MODE");
    const journal = await client.query("SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at");
    if (JSON.stringify(journal.rows.map((r) => r.hash)) !== JSON.stringify(expected)) {
      throw new Error("Historial local desconocido; la base no fue modificada.");
    }
    await client.query("ALTER TABLE idempotency_keys RENAME COLUMN request_hash TO legacy_request_hash");
    await client.query("DROP INDEX idempotency_scope_key_unique");
    await client.query("CREATE UNIQUE INDEX idempotency_scope_key_actor_unique ON idempotency_keys(scope,key,actor_user_id)");
    for (const statement of migration.sql) await client.query(statement);
    await client.query("INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)", [migration.hash, migration.folderMillis]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
