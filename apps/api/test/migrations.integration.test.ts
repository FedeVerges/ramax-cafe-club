import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { randomBytes } from "node:crypto";
import { adaptLegacyLocal } from "../src/database/adapt-legacy-local";
import { LEGACY_LOCAL_HASHES, matchesMigrationHistory } from "../src/database/migration-history";
import { readMigrationFiles } from "drizzle-orm/migrator";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("migraciones con datos anteriores", () => {
  it.each([false, true])("conserva datos y revierte incompatibilidades; historial local: %s", async (legacy) => {
    if (!url || !new URL(url).pathname.endsWith("_test"))
      throw new Error("Usá una base de prueba.");
    const adminUrl = new URL(url);
    adminUrl.pathname = "/postgres";
    const admin = new Pool({ connectionString: adminUrl.toString() });
    const name = `ramax_migration_${randomBytes(5).toString("hex")}_test`;
    const target = new URL(url);
    target.pathname = `/${name}`;
    const db = new Pool({ connectionString: target.toString() });
    const dir = await mkdtemp(join(tmpdir(), "ramax-migration-"));
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      const source = resolve("../../db/migrations");
      const journal = JSON.parse(
        await readFile(join(source, "meta/_journal.json"), "utf8"),
      );
      journal.entries = journal.entries.slice(0, 2);
      await mkdir(join(dir, "meta"));
      await writeFile(join(dir, "meta/_journal.json"), JSON.stringify(journal));
      for (const entry of journal.entries)
        await copyFile(
          join(source, `${entry.tag}.sql`),
          join(dir, `${entry.tag}.sql`),
        );
      await migrate(drizzle(db), { migrationsFolder: dir });
      if (legacy) {
        await db.query("ALTER TABLE idempotency_keys ADD COLUMN request_hash varchar(64) NOT NULL DEFAULT 'legacy'");
        await db.query("DROP INDEX idempotency_scope_key_actor_unique");
        await db.query("CREATE UNIQUE INDEX idempotency_scope_key_unique ON idempotency_keys(scope,key)");
        for (const [i, hash] of LEGACY_LOCAL_HASHES.entries()) {
          await db.query("INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)", [hash, 1790221588859 + i]);
        }
      }
      const apply = () => legacy
        ? adaptLegacyLocal(db, source)
        : migrate(drizzle(db), { migrationsFolder: source });
      const user = (
        await db.query(
          "INSERT INTO users(display_name,email) VALUES('Ana','ana@example.test') RETURNING id",
        )
      ).rows[0].id;
      const role = (
        await db.query(
          "INSERT INTO roles(name,description) VALUES('admin','Administrador') RETURNING id",
        )
      ).rows[0].id;
      await db.query(
        'INSERT INTO user_roles(user_id,role_id,"primary") VALUES($1,$2,true)',
        [user, role],
      );
      const sale = (
        await db.query(
          "INSERT INTO sales(total_ars,created_by_user_id) VALUES(1000,$1) RETURNING id",
          [user],
        )
      ).rows[0].id;
      // Incompatible old sales abort the entire migration; no partially converted schema remains.
      await expect(
        apply(),
      ).rejects.toThrow();
      await db.query(
        "INSERT INTO payments(sale_id,method,amount_ars) VALUES($1,'cash',1000)",
        [sale],
      );
      await db.query(
        "INSERT INTO idempotency_keys(scope,key,actor_user_id,response) VALUES('sales.close','old-key',$1,'{}')",
        [user],
      );
      await apply();
      expect(
        (
          await db.query("SELECT username,staff_role FROM users WHERE id=$1", [
            user,
          ])
        ).rows[0],
      ).toEqual({ username: "ana@example.test", staff_role: "admin" });
      expect(
        (
          await db.query(
            "SELECT sale_number,total_ars FROM sales WHERE id=$1",
            [sale],
          )
        ).rows[0],
      ).toEqual({ sale_number: 1, total_ars: 1000 });
      const old = (
        await db.query(
          "SELECT expires_at < now() AS expired, response FROM idempotency_keys WHERE key='old-key'",
        )
      ).rows[0];
      expect(old).toEqual({ expired: true, response: null });
      const applied = (await db.query("SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows.map((r) => r.hash);
      expect(matchesMigrationHistory(applied, readMigrationFiles({ migrationsFolder: source }).map((m) => m.hash))).toBe(true);
      if (legacy) {
        expect((await db.query("SELECT legacy_request_hash FROM idempotency_keys WHERE key='old-key'")).rows[0].legacy_request_hash).toBe("legacy");
        await expect(adaptLegacyLocal(db, source)).rejects.toThrow("Historial local desconocido");
      }
    } finally {
      await db.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.end();
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
});
