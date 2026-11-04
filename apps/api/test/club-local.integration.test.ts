import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";
import * as argon2 from "argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.E2_LOCAL_TEST_DATABASE_URL;
const sourceId = "1c34c371-e286-4838-a640-8e706d694c41";
const memberId = "e67e6b53-3202-4582-b1eb-1942e1111b2e";

describe.skipIf(!url)("E2 local sin internet", () => {
  const pool = new Pool({ connectionString: url });
  const base = "http://127.0.0.1:3132/api/v1";
  let api: ChildProcess;
  let cookie = "";
  let adminCookie = "";
  let productId = "";

  async function request(path: string, body?: unknown, key = randomUUID(), authCookie = cookie) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        cookie: authCookie,
        "content-type": "application/json",
        "idempotency-key": key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.text();
    return {
      status: response.status,
      body: data ? JSON.parse(data) : undefined,
      cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
    };
  }

  function sale(memberNumber?: string) {
    return {
      items: [{ productId, quantity: 1 }],
      expectedTotalArs: 11_500,
      paymentMethod: "cash",
      ...(memberNumber ? { memberNumber } : {}),
    };
  }

  beforeAll(async () => {
    if (!url || !new URL(url).pathname.endsWith("_test"))
      throw new Error("E2_LOCAL_TEST_DATABASE_URL debe terminar en _test.");
    await migrate(drizzle(pool), { migrationsFolder: resolve("../../db/migrations") });
    await pool.query(
      "TRUNCATE outbox_events, member_cache, point_rule_cache, idempotency_keys, stock_movements, payments, sale_items, sales, inventory_balances, products, audit_events, sessions, internal_credentials, user_roles, users CASCADE",
    );
    const hash = await argon2.hash("PruebaRamax123");
    const [employee] = (
      await pool.query(
        "INSERT INTO users(username, display_name, staff_role) VALUES ('lucia', 'Lucía', 'employee') RETURNING id",
      )
    ).rows;
    await pool.query(
      "INSERT INTO internal_credentials(user_id, password_hash) VALUES ($1,$2)",
      [employee.id, hash],
    );
    const [admin] = (
      await pool.query(
        "INSERT INTO users(username, display_name, staff_role) VALUES ('admin', 'Ana', 'admin') RETURNING id",
      )
    ).rows;
    await pool.query(
      "INSERT INTO internal_credentials(user_id, password_hash) VALUES ($1,$2)",
      [admin.id, hash],
    );
    const [product] = (
      await pool.query(
        "INSERT INTO products(name, price_ars, tracks_stock) VALUES ('Combo Ramax', 11500, false) RETURNING id",
      )
    ).rows;
    productId = product.id;
    await pool.query(
      "INSERT INTO member_cache(member_id, member_number, display_name, status, confirmed_balance, synced_at) VALUES ($1,'004281','Sofía','active',120,now())",
      [memberId],
    );
    await pool.query(
      "INSERT INTO point_rule_cache(version, pesos_por_punto, effective_at, synced_at) VALUES (1,100,now()-interval '1 day',now())",
    );
    api = spawn(process.execPath, [resolve("dist/apps/api/src/main.js")], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: url,
        PORT: "3132",
        BACKUP_DIR: resolve("../../var/e2-local-integration-backups"),
        WEB_DIST_DIR: "",
        INTERNET_PROBE_URL: "http://127.0.0.1:1",
        CLUB_CLOUD_API_URL: "http://127.0.0.1:1/api/v1",
        CLUB_SERVICE_TOKEN: "ramax-cloud-integration-test-secret-12345",
        CLUB_SOURCE_ID: sourceId,
      },
      stdio: "pipe",
    });
    let output = "";
    api.stdout?.on("data", (data) => (output += data.toString()));
    api.stderr?.on("data", (data) => (output += data.toString()));
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(base + "/health")).ok) break;
      } catch {
        /* wait for local API */
      }
      if (api.exitCode !== null) throw new Error(output);
      await new Promise((done) => setTimeout(done, 100));
    }
    const login = await request("/auth/login", {
      username: "lucia",
      password: "PruebaRamax123",
    });
    expect(login.status).toBe(201);
    cookie = login.cookie;
    const adminLogin = await request("/auth/login", {
      username: "admin",
      password: "PruebaRamax123",
    });
    expect(adminLogin.status).toBe(201);
    adminCookie = adminLogin.cookie;
  }, 30000);

  afterAll(async () => {
    api?.kill();
    await pool.end();
  });

  it("consulta el socio guardado y explica cuándo falta la caché", async () => {
    const known = await request("/members/by-number/004281");
    expect(known.body).toMatchObject({
      displayName: "Sofía",
      confirmedBalance: 120,
      source: "cache",
    });
    const unknown = await request("/members/by-number/999999");
    expect(unknown.status).toBe(503);
    expect(unknown.body.code).toBe("MEMBER_NOT_CACHED");
  });

  it("cierra offline con socio y congela regla y evento en la venta", async () => {
    const result = await request("/sales", sale("004281"));
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({ pointsEarned: 115, pointsSyncStatus: "pending" });
    const detail = await request(`/sales/${result.body.saleId}`);
    expect(detail.body).toMatchObject({
      memberNumberLast4: "4281",
      pointsEarned: 115,
      pointsSyncStatus: "pending",
    });
    expect(JSON.stringify(detail.body)).not.toContain("004281");
    const [row] = (
      await pool.query(
        "SELECT s.pesos_por_punto, s.point_rule_version, s.member_id, o.event_type, o.payload FROM sales s JOIN outbox_events o ON o.sale_id=s.id WHERE s.id=$1",
        [result.body.saleId],
      )
    ).rows;
    expect(row).toMatchObject({
      pesos_por_punto: 100,
      point_rule_version: 1,
      member_id: memberId,
      event_type: "sale.closed",
    });
    expect(row.payload.pointsEarned).toBe(115);
  });

  it("permite una asociación tardía una sola vez y rechaza el plazo vencido", async () => {
    const first = await request("/sales", sale());
    const key = randomUUID();
    const attached = await request(
      `/sales/${first.body.saleId}/member`,
      { memberNumber: "004281" },
      key,
    );
    const replay = await request(
      `/sales/${first.body.saleId}/member`,
      { memberNumber: "004281" },
      key,
    );
    expect(attached.body).toMatchObject({ pointsEarned: 115, pointsSyncStatus: "pending" });
    expect(replay.body).toEqual(attached.body);
    expect((await request(`/sales/${first.body.saleId}/member`, { memberNumber: "004281" })).status).toBe(409);
    const [count] = (
      await pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE sale_id=$1", [first.body.saleId])
    ).rows;
    expect(count.n).toBe(2);

    const old = await request("/sales", sale());
    await pool.query(
      "UPDATE sales SET created_at=now()-interval '24 hours 1 second' WHERE id=$1",
      [old.body.saleId],
    );
    const expired = await request(`/sales/${old.body.saleId}/member`, { memberNumber: "004281" });
    expect(expired.body.code).toBe("ATTACHMENT_EXPIRED");
  });

  it("anula offline sin perder el cierre y agrega una sola reversión pendiente", async () => {
    const result = await request("/sales", sale("004281"));
    const key = randomUUID();
    const input = { reason: "Devolución", refundConfirmed: true };
    const first = await request(`/sales/${result.body.saleId}/void`, input, key, adminCookie);
    const replay = await request(`/sales/${result.body.saleId}/void`, input, key, adminCookie);
    expect(first.status).toBe(201);
    expect(first.body).toEqual(replay.body);
    const [row] = (
      await pool.query(
        "SELECT s.status, s.sale_version, s.points_sync_status, count(o.event_id)::int AS events FROM sales s JOIN outbox_events o ON o.sale_id=s.id WHERE s.id=$1 GROUP BY s.id",
        [result.body.saleId],
      )
    ).rows;
    expect(row).toMatchObject({
      status: "void",
      sale_version: 2,
      points_sync_status: "pending",
      events: 2,
    });
  });
});
