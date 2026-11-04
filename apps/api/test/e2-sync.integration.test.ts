import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";
import * as argon2 from "argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const localUrl = process.env.E2_SYNC_LOCAL_TEST_DATABASE_URL;
const cloudUrl = process.env.E2_SYNC_CLOUD_TEST_DATABASE_URL;
const sourceId = "1c34c371-e286-4838-a640-8e706d694c41";
const serviceToken = "ramax-cloud-integration-test-secret-12345";
const localBase = "http://127.0.0.1:3133/api/v1";
const cloudBase = "http://127.0.0.1:3233/api/v1";

describe.skipIf(!localUrl || !cloudUrl)("E2 entre caja local y cloud", () => {
  const local = new Pool({ connectionString: localUrl });
  const cloud = new Pool({ connectionString: cloudUrl });
  let localApi: ChildProcess;
  let cloudApi: ChildProcess;
  let employeeCookie = "";
  let adminCookie = "";
  let productId = "";
  let memberId = "";

  async function waitFor(predicate: () => Promise<boolean>, label: string) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await predicate()) return;
      await new Promise((done) => setTimeout(done, 300));
    }
    throw new Error(`No se alcanzó el estado: ${label}`);
  }

  function spawnApi(entry: string, env: Record<string, string>) {
    return spawn(process.execPath, [resolve(entry)], {
      env: { ...process.env, NODE_ENV: "test", ...env },
      stdio: "pipe",
    });
  }

  function startCloud() {
    cloudApi = spawnApi("dist/apps/api/src/main-cloud.js", {
      CLOUD_DATABASE_URL: cloudUrl!,
      CLOUD_PORT: "3233",
      CLUB_SOURCE_ID: sourceId,
      CLUB_SERVICE_TOKEN: serviceToken,
      GOOGLE_CLIENT_ID: "ramax-test.apps.googleusercontent.com",
      PILOT_MEMBER_LOGIN_ENABLED: "true",
      PILOT_MEMBER_ACCESS_CODE: "ramax-pilot-member-test-code-123456",
    });
  }

  async function localRequest(path: string, body?: unknown, cookie = employeeCookie) {
    const response = await fetch(localBase + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie, "content-type": "application/json", "idempotency-key": randomUUID() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.text();
    return {
      status: response.status,
      body: data ? JSON.parse(data) : undefined,
      cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
    };
  }

  async function balance() {
    const [row] = (await cloud.query(
      "SELECT coalesce(sum(delta),0)::int AS points FROM point_ledger WHERE member_id=$1",
      [memberId],
    )).rows;
    return row.points as number;
  }

  beforeAll(async () => {
    if (!localUrl || !cloudUrl || localUrl === cloudUrl ||
        !new URL(localUrl).pathname.endsWith("_test") ||
        !new URL(cloudUrl).pathname.endsWith("_test"))
      throw new Error("E2 requiere dos bases aisladas distintas terminadas en _test.");
    await migrate(drizzle(local), { migrationsFolder: resolve("../../db/migrations") });
    await migrate(drizzle(cloud), { migrationsFolder: resolve("../../db/cloud-migrations") });
    await local.query("TRUNCATE outbox_events, member_cache, point_rule_cache, idempotency_keys, stock_movements, payments, sale_items, sales, inventory_balances, products, audit_events, sessions, internal_credentials, user_roles, users CASCADE");
    await cloud.query("TRUNCATE point_allocations, point_lots, point_ledger, inbox_events, cloud_sales, point_rules, member_sessions, members, cloud_audit_events CASCADE");
    memberId = (await cloud.query("INSERT INTO members(member_number, google_sub, display_name, email) VALUES ('004281','integration-sub','Sofía','sofia@example.test') RETURNING id")).rows[0].id;
    await cloud.query("INSERT INTO point_rules(version,pesos_por_punto,effective_at) VALUES (1,100,now()-interval '1 day')");
    const hash = await argon2.hash("PruebaRamax123");
    for (const [username, role] of [["lucia", "employee"], ["admin", "admin"]]) {
      const id = (await local.query("INSERT INTO users(username,display_name,staff_role) VALUES ($1,$1,$2) RETURNING id", [username, role])).rows[0].id;
      await local.query("INSERT INTO internal_credentials(user_id,password_hash) VALUES ($1,$2)", [id, hash]);
    }
    productId = (await local.query("INSERT INTO products(name,price_ars,tracks_stock) VALUES ('Combo',11500,false) RETURNING id")).rows[0].id;
    await local.query("INSERT INTO member_cache(member_id,member_number,display_name,status,confirmed_balance,synced_at) VALUES ($1,'004281','Sofía','active',0,now())", [memberId]);
    await local.query("INSERT INTO point_rule_cache(version,pesos_por_punto,effective_at,synced_at) VALUES (1,100,now()-interval '1 day',now())");
    startCloud();
    localApi = spawnApi("dist/apps/api/src/main.js", {
      DATABASE_URL: localUrl,
      PORT: "3133",
      BACKUP_DIR: resolve("../../var/e2-sync-integration-backups"),
      WEB_DIST_DIR: "",
      INTERNET_PROBE_URL: "http://127.0.0.1:1",
      CLUB_CLOUD_API_URL: cloudBase,
      CLUB_SERVICE_TOKEN: serviceToken,
      CLUB_SOURCE_ID: sourceId,
    });
    await waitFor(async () => {
      try { return (await fetch(localBase + "/health")).ok && (await fetch(cloudBase + "/health")).ok; }
      catch { return false; }
    }, "arranque de ambas API");
    employeeCookie = (await localRequest("/auth/login", { username: "lucia", password: "PruebaRamax123" })).cookie;
    adminCookie = (await localRequest("/auth/login", { username: "admin", password: "PruebaRamax123" })).cookie;
  }, 30000);

  afterAll(async () => {
    localApi?.kill();
    cloudApi?.kill();
    await local.end();
    await cloud.end();
  });

  it("acredita online y sincroniza una asociación offline y su anulación", async () => {
    const input = { items: [{ productId, quantity: 1 }], expectedTotalArs: 11_500, paymentMethod: "cash", memberNumber: "004281" };
    const first = await localRequest("/sales", input);
    expect(first.status).toBe(201);
    await waitFor(async () => (await balance()) === 115, "primera acreditación");
    await waitFor(async () => (await localRequest(`/sales/${first.body.saleId}`)).body.pointsSyncStatus === "confirmed", "acuse local");

    cloudApi.kill();
    await once(cloudApi, "exit");
    const offline = await localRequest("/sales", { ...input, memberNumber: undefined });
    expect(offline.status).toBe(201);
    expect((await localRequest(`/sales/${offline.body.saleId}`)).body.status).toBe("closed");
    const attach = await localRequest(`/sales/${offline.body.saleId}/member`, { memberNumber: "004281" });
    expect(attach.body.pointsSyncStatus).toBe("pending");
    expect(await balance()).toBe(115);

    startCloud();
    await waitFor(async () => {
      try { return (await fetch(cloudBase + "/health")).ok; }
      catch { return false; }
    }, "reinicio cloud");
    await waitFor(async () => (await balance()) === 230, "asociación acreditada una vez");
    const voided = await localRequest(`/sales/${offline.body.saleId}/void`, { reason: "Devolución", refundConfirmed: true }, adminCookie);
    expect(voided.status).toBe(201);
    await waitFor(async () => (await balance()) === 115, "reversión cloud");
    const count = (await cloud.query("SELECT count(*)::int AS n FROM inbox_events WHERE sale_id=$1", [offline.body.saleId])).rows[0].n;
    expect(count).toBe(3);
  }, 60000);

  it("restringe la administración y propaga cambios al cloud y a la caché local", async () => {
    expect((await localRequest("/club-admin/members")).status).toBe(403);
    const listed = await localRequest("/club-admin/members", undefined, adminCookie);
    expect(listed.status).toBe(200);
    expect(listed.body[0]).toMatchObject({ id: memberId, memberNumber: "004281" });

    const adjustment = await localRequest(
      `/club-admin/members/${memberId}/points`,
      { delta: 20, reason: "Corrección de prueba" },
      adminCookie,
    );
    expect(adjustment.status).toBe(201);
    expect(adjustment.body.confirmedBalance).toBe(135);
    expect((await localRequest(`/club-admin/members/${memberId}`, undefined, adminCookie)).body.points.confirmedBalance).toBe(135);
    expect((await local.query("SELECT confirmed_balance FROM member_cache WHERE member_id=$1", [memberId])).rows[0].confirmed_balance).toBe(135);

    const suspend = await localRequest(
      `/club-admin/members/${memberId}/status`,
      { status: "suspended", reason: "Control de prueba" },
      adminCookie,
    );
    expect(suspend.status).toBe(201);
    expect(suspend.body.status).toBe("suspended");
    expect((await local.query("SELECT status FROM member_cache WHERE member_id=$1", [memberId])).rows[0].status).toBe("suspended");
    expect((await localRequest("/members/by-number/004281")).body.status).toBe("suspended");

    const reactivate = await localRequest(
      `/club-admin/members/${memberId}/status`,
      { status: "active", reason: "Control terminado" },
      adminCookie,
    );
    expect(reactivate.status).toBe(201);
    const changedRule = await localRequest("/club-admin/point-rule", { pesosPorPunto: 200 }, adminCookie);
    expect(changedRule.status).toBe(201);
    expect(changedRule.body).toMatchObject({ version: 2, pesosPorPunto: 200 });
    const rule = await localRequest("/club-admin/point-rule", undefined, adminCookie);
    expect(rule.body.pending.version).toBe(2);
  }, 30000);

  it("conserva la venta y detiene el reintento ante un evento inválido", async () => {
    cloudApi.kill();
    await once(cloudApi, "exit");
    const sale = await localRequest("/sales", {
      items: [{ productId, quantity: 1 }],
      expectedTotalArs: 11_500,
      paymentMethod: "cash",
      memberNumber: "004281",
    });
    expect(sale.status).toBe(201);
    await local.query(
      "UPDATE outbox_events SET payload=jsonb_set(payload,'{pointsEarned}','999'::jsonb), next_attempt_at=now() WHERE sale_id=$1",
      [sale.body.saleId],
    );
    startCloud();
    await waitFor(async () => {
      try { return (await fetch(cloudBase + "/health")).ok; }
      catch { return false; }
    }, "reinicio cloud para rechazo");
    await waitFor(async () => {
      const result = await local.query("SELECT status FROM outbox_events WHERE sale_id=$1", [sale.body.saleId]);
      return result.rows[0]?.status === "rejected";
    }, "rechazo definitivo");
    expect((await localRequest(`/sales/${sale.body.saleId}`)).body).toMatchObject({ status: "closed", pointsSyncStatus: "rejected" });
  }, 45000);

  it("acredita una compra al socio que ingresó con el código piloto", async () => {
    const csrfResponse = await fetch(cloudBase + "/club/auth/csrf");
    const csrf = (await csrfResponse.json()).csrfToken as string;
    const login = await fetch(cloudBase + "/club/auth/pilot", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `ramax_member_csrf=${csrf}`,
        "x-csrf-token": csrf,
      },
      body: JSON.stringify({ code: "ramax-pilot-member-test-code-123456" }),
    });
    expect(login.status).toBe(201);
    const profile = (await login.json()).member as { id: string; memberNumber: string };
    const memberCookie = login.headers.get("set-cookie")!.split(";")[0];
    const lookup = await localRequest(`/members/by-number/${profile.memberNumber}`);
    expect(lookup.status).toBe(200);
    const sale = await localRequest("/sales", {
      items: [{ productId, quantity: 1 }],
      expectedTotalArs: 11_500,
      paymentMethod: "cash",
      memberNumber: profile.memberNumber,
    });
    expect(sale.status, JSON.stringify(sale.body)).toBe(201);
    await waitFor(async () => {
      const result = await cloud.query(
        "SELECT coalesce(sum(delta),0)::int AS points FROM point_ledger WHERE member_id=$1",
        [profile.id],
      );
      return result.rows[0].points > 0;
    }, "acreditación del socio piloto");
    const account = await fetch(cloudBase + "/club/points", {
      headers: { cookie: memberCookie },
    });
    expect(account.status).toBe(200);
    expect((await account.json()).confirmedBalance).toBeGreaterThan(0);
  }, 45000);
});
