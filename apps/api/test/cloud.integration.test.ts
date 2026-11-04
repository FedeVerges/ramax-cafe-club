import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as cloudSchema from "../../../db/cloud-schema";
import { PointsService } from "../src/modules/points/points.service";

const url = process.env.CLOUD_TEST_DATABASE_URL;
const sourceId = "1c34c371-e286-4838-a640-8e706d694c41";
const token = "ramax-cloud-integration-test-secret-12345";

describe.skipIf(!url)("E2 cloud con PostgreSQL real", () => {
  const pool = new Pool({ connectionString: url });
  const base = "http://127.0.0.1:3232/api/v1";
  let api: ChildProcess;
  let memberId = "";

  async function request(path: string, body?: unknown, authorized = true, key?: string) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        ...(authorized ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { "idempotency-key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }

  function event(
    saleId: string,
    saleVersion: number,
    eventType: "sale.closed" | "sale.member_attached" | "sale.voided",
    extra: Record<string, unknown> = {},
  ) {
    return {
      schemaVersion: 1,
      eventId: randomUUID(),
      sourceId,
      saleId,
      saleVersion,
      occurredAt: new Date().toISOString(),
      eventType,
      ...extra,
    };
  }

  function closed(saleId: string, member: string | null = memberId) {
    return event(saleId, 1, "sale.closed", {
      saleNumber: 101,
      totalArs: 11_500,
      closedAt: new Date().toISOString(),
      memberId: member,
      pointRuleVersion: 1,
      pesosPorPunto: 100,
      pointsEarned: 115,
      items: [{ productName: "Combo Ramax", quantity: 1, unitPriceArs: 11_500, subtotalArs: 11_500 }],
    });
  }

  beforeAll(async () => {
    if (!url || !new URL(url).pathname.endsWith("_test"))
      throw new Error("CLOUD_TEST_DATABASE_URL debe terminar en _test.");
    await migrate(drizzle(pool), {
      migrationsFolder: resolve("../../db/cloud-migrations"),
    });
    await pool.query(
      "TRUNCATE point_allocations, point_lots, point_ledger, inbox_events, cloud_sales, point_rules, member_sessions, members, cloud_audit_events CASCADE",
    );
    const [member] = (
      await pool.query(
        "INSERT INTO members(member_number, google_sub, display_name, email) VALUES ('004281', 'google-test-sub', 'Sofía', 'sofia@example.test') RETURNING id",
      )
    ).rows;
    memberId = member.id;
    await pool.query(
      "INSERT INTO point_rules(version, pesos_por_punto, effective_at) VALUES (1, 100, now() - interval '1 day')",
    );
    api = spawn(process.execPath, [resolve("dist/apps/api/src/main-cloud.js")], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        CLOUD_DATABASE_URL: url,
        CLOUD_PORT: "3232",
        CLUB_SOURCE_ID: sourceId,
        CLUB_SERVICE_TOKEN: token,
        GOOGLE_CLIENT_ID: "ramax-test.apps.googleusercontent.com",
        PILOT_MEMBER_LOGIN_ENABLED: "true",
        PILOT_MEMBER_ACCESS_CODE: "ramax-pilot-member-test-code-123456",
      },
      stdio: "pipe",
    });
    let output = "";
    api.stdout?.on("data", (data) => (output += data.toString()));
    api.stderr?.on("data", (data) => (output += data.toString()));
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(base + "/health")).ok) return;
      } catch {
        /* wait for cloud API */
      }
      if (api.exitCode !== null) throw new Error(output);
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error(`Cloud API did not start: ${output}`);
  }, 30000);

  afterAll(async () => {
    api?.kill();
    await pool.end();
  });

  it("protege la integración y limita la búsqueda laboral", async () => {
    expect((await request("/integration/members/004281", undefined, false)).status).toBe(401);
    const lookup = await request("/integration/members/004281");
    expect(lookup.status).toBe(200);
    expect(lookup.body).toMatchObject({
      memberNumber: "004281",
      displayName: "Sofía",
      confirmedBalance: 0,
      source: "cloud",
    });
    expect(JSON.stringify(lookup.body)).not.toContain("sofia@example.test");
    expect((await request("/integration/point-rule")).body.pesosPorPunto).toBe(100);
  });

  it("exige sesión y CSRF para las operaciones del socio", async () => {
    const anonymous = await fetch(base + "/club/auth/me");
    expect(await anonymous.json()).toEqual({ authenticated: false });
    expect((await fetch(base + "/club/points")).status).toBe(401);
    const csrf = await fetch(base + "/club/auth/csrf");
    const token = (await csrf.json()).csrfToken as string;
    expect(csrf.headers.get("set-cookie")).toContain("HttpOnly");
    const denied = await fetch(base + "/club/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ramax_member_csrf=${token}` },
      body: JSON.stringify({ credential: "a".repeat(120) }),
    });
    expect(denied.status).toBe(401);
    const invalidGoogle = await fetch(base + "/club/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ramax_member_csrf=${token}`, "x-csrf-token": token },
      body: JSON.stringify({ credential: "a".repeat(120) }),
    });
    expect(invalidGoogle.status).toBe(401);
  });

  it("acredita una sola vez si se reenvía el mismo cierre", async () => {
    const saleId = randomUUID();
    const close = closed(saleId);
    const first = await request("/integration/events", close);
    const second = await request("/integration/events", close);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ status: "accepted", confirmedBalance: 115 });
    expect(second.body).toEqual(first.body);
    const [count] = (
      await pool.query("SELECT count(*)::int AS n FROM point_ledger WHERE cause_key LIKE 'credit:%'")
    ).rows;
    expect(count.n).toBe(1);
  });

  it("espera un cierre faltante y acredita al asociar después", async () => {
    const saleId = randomUUID();
    const attach = event(saleId, 2, "sale.member_attached", { memberId });
    expect((await request("/integration/events", attach)).body.status).toBe("deferred");
    expect((await request("/integration/events", closed(saleId, null))).body.status).toBe("accepted");
    expect((await request("/integration/events", attach)).body).toMatchObject({
      status: "accepted",
      confirmedBalance: 230,
    });
  });

  it("anula sin duplicar la reversión y permite saldo negativo", async () => {
    const saleId = randomUUID();
    expect((await request("/integration/events", closed(saleId))).body.status).toBe("accepted");
    await pool.query(
      "INSERT INTO point_ledger(member_id, cause_key, kind, delta) VALUES ($1, $2, 'adjustment', -300)",
      [memberId, `spent:${saleId}`],
    );
    const voidEvent = event(saleId, 2, "sale.voided");
    const one = await request("/integration/events", voidEvent);
    const two = await request("/integration/events", voidEvent);
    expect(one.body).toMatchObject({ status: "accepted", confirmedBalance: -70 });
    expect(two.body).toEqual(one.body);
  });

  it("rechaza un socio suspendido sin perder la venta", async () => {
    await pool.query("UPDATE members SET status='suspended' WHERE id=$1", [memberId]);
    const saleId = randomUUID();
    const close = await request("/integration/events", closed(saleId));
    expect(close.body).toMatchObject({ status: "rejected", code: "MEMBER_INACTIVE" });
    expect((await request("/integration/events", event(saleId, 2, "sale.voided"))).body.status).toBe("accepted");
    const [sale] = (
      await pool.query("SELECT status, processed_version FROM cloud_sales WHERE sale_id=$1", [saleId])
    ).rows;
    expect(sale).toMatchObject({ status: "void", processed_version: 2 });
  });

  it("administra socios y ajustes con auditoría e idempotencia", async () => {
    const actorStaffId = randomUUID();
    const listed = await request("/integration/admin/members");
    expect(listed.body[0].email).toBe("sofia@example.test");

    const reactivate = {
      actorStaffId,
      status: "active",
      reason: "Revisión de la cuenta",
    };
    const statusKey = randomUUID();
    const firstStatus = await request(
      `/integration/admin/members/${memberId}/status`, reactivate, true, statusKey,
    );
    const secondStatus = await request(
      `/integration/admin/members/${memberId}/status`, reactivate, true, statusKey,
    );
    expect(firstStatus.body).toEqual(secondStatus.body);
    expect(firstStatus.body.status).toBe("active");

    const adjustment = {
      actorStaffId,
      delta: 25,
      reason: "Corrección de compra",
    };
    const adjustmentKey = randomUUID();
    const one = await request(
      `/integration/admin/members/${memberId}/points`, adjustment, true, adjustmentKey,
    );
    const two = await request(
      `/integration/admin/members/${memberId}/points`, adjustment, true, adjustmentKey,
    );
    expect(one.body).toEqual(two.body);
    expect(one.body.confirmedBalance).toBe(-45);
    const [audit] = (await pool.query(
      "SELECT count(*)::int AS n FROM cloud_audit_events WHERE action='points.adjusted'",
    )).rows;
    expect(audit.n).toBe(1);
  });

  it("versiona la regla y bloquea dos cambios pendientes", async () => {
    const actorStaffId = randomUUID();
    const body = { actorStaffId, pesosPorPunto: 200 };
    const key = randomUUID();
    const one = await request("/integration/admin/point-rule", body, true, key);
    const two = await request("/integration/admin/point-rule", body, true, key);
    expect(one.body).toEqual(two.body);
    expect(one.body).toMatchObject({ version: 2, pesosPorPunto: 200 });
    expect(new Date(one.body.effectiveAt).getTime()).toBeGreaterThan(Date.now());
    expect((await request("/integration/admin/point-rule", { actorStaffId, pesosPorPunto: 250 }, true, randomUUID())).status).toBe(409);
  });

  it("vence un lote una sola vez y no lo revierte dos veces al anular", async () => {
    const secondMemberId = (await pool.query(
      "INSERT INTO members(member_number, google_sub, display_name, email) VALUES ('004282','expiry-test-sub','Lote','lote@example.test') RETURNING id",
    )).rows[0].id as string;
    const saleId = randomUUID();
    expect((await request("/integration/events", closed(saleId, secondMemberId))).body.confirmedBalance).toBe(115);
    await pool.query("UPDATE point_lots SET expires_at=now()-interval '1 minute' WHERE member_id=$1", [secondMemberId]);
    const points = new PointsService(drizzle(pool, { schema: cloudSchema }));
    await points.expireDue();
    await points.expireDue();
    expect((await points.balance(secondMemberId))).toBe(0);
    const reversed = await request("/integration/events", event(saleId, 2, "sale.voided"));
    expect(reversed.body).toMatchObject({ status: "accepted", confirmedBalance: 0 });
    expect((await points.balance(secondMemberId))).toBe(0);
    const [expiry] = (await pool.query(
      "SELECT count(*)::int AS n FROM point_ledger WHERE member_id=$1 AND kind='expiry'",
      [secondMemberId],
    )).rows;
    expect(expiry.n).toBe(1);
  });

  it("pagina movimientos sin truncar una cuenta con más de 25", async () => {
    const id = (await pool.query(
      "INSERT INTO members(member_number, google_sub, display_name, email) VALUES ('004283','paging-test-sub','Historial','historial@example.test') RETURNING id",
    )).rows[0].id as string;
    await pool.query(
      "INSERT INTO point_ledger(member_id,cause_key,kind,delta,description) SELECT $1, 'paging:' || n, 'adjustment', 1, 'Prueba' FROM generate_series(1,30) n",
      [id],
    );
    const points = new PointsService(drizzle(pool, { schema: cloudSchema }));
    const first = await points.account(id, 1);
    const second = await points.account(id, 2);
    expect(first).toMatchObject({ confirmedBalance: 30, hasMore: true });
    expect(second).toMatchObject({ confirmedBalance: 30, hasMore: false });
    expect(first.movements).toHaveLength(25);
    expect(second.movements).toHaveLength(5);
    expect(new Set([...first.movements, ...second.movements].map((row) => row.id)).size).toBe(30);
  });

  it("permite un único socio de prueba con código y CSRF", async () => {
    const methods = await fetch(base + "/club/auth/methods");
    expect(await methods.json()).toEqual({ pilot: true });
    const csrf = await fetch(base + "/club/auth/csrf");
    const csrfToken = (await csrf.json()).csrfToken as string;
    const cookie = `ramax_member_csrf=${csrfToken}`;
    const login = (code: string, includeCsrf = true) => fetch(base + "/club/auth/pilot", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        ...(includeCsrf ? { "x-csrf-token": csrfToken } : {}),
      },
      body: JSON.stringify({ code }),
    });
    expect((await login("ramax-pilot-member-test-code-123456", false)).status).toBe(401);
    expect((await login("incorrecto")).status).toBe(401);
    const first = await login("ramax-pilot-member-test-code-123456");
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.member).toMatchObject({
      displayName: "Socio de prueba",
      accessMethod: "pilot",
    });
    expect(first.headers.get("set-cookie")).toContain("ramax_member_session=");
    const second = await login("ramax-pilot-member-test-code-123456");
    expect((await second.json()).member.id).toBe(firstBody.member.id);
    const sessionCookie = first.headers.get("set-cookie")!.split(";")[0];
    const session = await fetch(base + "/club/auth/me", {
      headers: { cookie: sessionCookie },
    });
    expect((await session.json()).member.id).toBe(firstBody.member.id);
  });
});
