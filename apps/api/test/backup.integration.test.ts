import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { resolve, join } from "node:path";
import { appendFile } from "node:fs/promises";
import { Pool } from "pg";
import * as argon2 from "argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  createBackup,
  restoreBackup,
  workerTick,
} from "../src/modules/backups/backup-engine";
import {
  backupDir,
  inMaintenance,
  listBackups,
  readJson,
} from "../src/modules/backups/backup-files";
import type { RecoveryJob } from "../../../packages/contracts/src";
const url = process.env.BACKUP_TEST_DATABASE_URL;
describe.skipIf(!url)("backup y restauración PostgreSQL", () => {
  const db = new Pool({ connectionString: url });
  let api: ChildProcess;
  let actorId: string;
  let productId: string;
  beforeAll(async () => {
    if (!url || !new URL(url).pathname.endsWith("_test"))
      throw new Error("La base de recuperación debe terminar en _test.");
    db.on("error", () => undefined);
    process.env.DATABASE_URL = url;
    process.env.RECOVERY_DATABASE_URL = url;
    process.env.RECOVERY_HEALTH_URL = "http://127.0.0.1:3132/api/v1/health";
    process.env.MIGRATIONS_DIR = resolve("../../db/migrations");
    if (!process.env.BACKUP_DIR || !process.env.PG_BIN_DIR)
      throw new Error("Definí BACKUP_DIR y PG_BIN_DIR de prueba.");
    await migrate(drizzle(db), {
      migrationsFolder: process.env.MIGRATIONS_DIR,
    });
    const [user] = (
      await db.query(
        "INSERT INTO users(username,display_name,staff_role) VALUES($1,'Backup Admin','admin') RETURNING id",
        [`backup_${randomBytes(5).toString("hex")}`],
      )
    ).rows;
    actorId = user.id;
    await db.query(
      "INSERT INTO internal_credentials(user_id,password_hash) VALUES($1,$2)",
      [actorId, await argon2.hash("PruebaRamax123")],
    );
    const [product] = (
      await db.query(
        "INSERT INTO products(name,price_ars) VALUES('Café recuperación',1000) RETURNING id",
      )
    ).rows;
    productId = product.id;
    await db.query(
      "INSERT INTO inventory_balances(product_id,quantity) VALUES($1,5)",
      [productId],
    );
    api = spawn(process.execPath, [resolve("dist/apps/api/src/main.js")], {
      env: {
        ...process.env,
        DATABASE_URL: url,
        NODE_ENV: "test",
        PORT: "3132",
        WEB_DIST_DIR: "",
        INTERNET_PROBE_URL: "http://127.0.0.1:1",
      },
      stdio: "pipe",
    });
    for (let n = 0; n < 100; n++) {
      try {
        if ((await fetch(process.env.RECOVERY_HEALTH_URL)).ok) break;
      } catch {
        /* wait */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }, 30000);
  afterAll(async () => {
    api?.kill();
    await db.end();
  });
  it("crea copia validada, restaura datos y permite una venta después", async () => {
    const backup = await createBackup();
    expect(backup.status).toBe("valid");
    await db.query("UPDATE products SET price_ars=9999 WHERE id=$1", [
      productId,
    ]);
    // Close all test connections before the restore terminates live connections.
    const job: RecoveryJob = {
      id: randomBytes(32).toString("hex"),
      backupId: backup.id,
      actorId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await restoreBackup(job);
    const result = await readJson<RecoveryJob>(
      join(backupDir(), `${job.id}.job.json`),
    );
    expect(result.status).toBe("succeeded");
    expect(inMaintenance()).toBe(false);
    const check = new Pool({ connectionString: url });
    try {
      expect(
        (
          await check.query("SELECT price_ars FROM products WHERE id=$1", [
            productId,
          ])
        ).rows[0].price_ars,
      ).toBe(1000);
      const username = (
        await check.query("SELECT username FROM users WHERE id=$1", [actorId])
      ).rows[0].username;
      const login = await fetch("http://127.0.0.1:3132/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password: "PruebaRamax123" }),
      });
      const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
      const sale = await fetch("http://127.0.0.1:3132/api/v1/sales", {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json",
          "idempotency-key": randomUUID(),
        },
        body: JSON.stringify({
          items: [{ productId, quantity: 1 }],
          paymentMethod: "cash",
          expectedTotalArs: 1000,
        }),
      });
      expect(sale.status).toBe(201);
      expect(
        (
          await check.query(
            "SELECT quantity FROM inventory_balances WHERE product_id=$1",
            [productId],
          )
        ).rows[0].quantity,
      ).toBe(4);
    } finally {
      await check.end();
    }
    await workerTick();
    expect(
      (await listBackups()).filter(
        (b) => b.status === "valid" && b.id === backup.id,
      ),
    ).toHaveLength(1);
    const toolsPath = process.env.PG_BIN_DIR;
    process.env.PG_BIN_DIR = resolve("../../var/no-such-pg-tools");
    const failedBackup = await createBackup();
    expect(failedBackup.status).toBe("failed");
    expect(
      (await listBackups()).some(
        (b) => b.id === backup.id && b.status === "valid",
      ),
    ).toBe(true);
    process.env.PG_BIN_DIR = toolsPath;
    await appendFile(join(backupDir(), `${backup.id}.dump`), "corrupt");
    const corrupt = {
      ...job,
      id: randomBytes(32).toString("hex"),
      status: "pending" as const,
    };
    await restoreBackup(corrupt);
    expect(
      (await readJson<RecoveryJob>(join(backupDir(), `${corrupt.id}.job.json`)))
        .status,
    ).toBe("failed");
    expect(inMaintenance()).toBe(false);
  }, 60000);
});
