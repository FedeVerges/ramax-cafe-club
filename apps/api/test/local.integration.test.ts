import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";
import * as argon2 from "argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("E0/E1 con PostgreSQL real", () => {
  const pool = new Pool({ connectionString: url });
  let api: ChildProcess;
  let admin = "";
  let employee = "";
  let productId = "";
  let employeeId = "";
  let adminId = "";
  const base = "http://127.0.0.1:3131/api/v1";
  async function request(
    path: string,
    token: string,
    body?: unknown,
    key = randomUUID(),
    method = "POST",
  ) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : method,
      headers: {
        cookie: token,
        "content-type": "application/json",
        "idempotency-key": key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : undefined,
      cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
    };
  }
  beforeAll(async () => {
    if (!url || !new URL(url).pathname.endsWith("_test"))
      throw new Error(
        "TEST_DATABASE_URL debe apuntar a una base aislada terminada en _test.",
      );
    await migrate(drizzle(pool), {
      migrationsFolder: resolve("../../db/migrations"),
    });
    await pool.query(
      "TRUNCATE idempotency_keys, stock_movements, payments, sale_items, sales, inventory_balances, products, audit_events, sessions, internal_credentials, user_roles, users CASCADE",
    );
    const hash = await argon2.hash("PruebaRamax123");
    const result = await pool.query(
      "INSERT INTO users (username, display_name, staff_role) VALUES ('admin', 'Ana', 'admin'), ('lucia', 'Lucía', 'employee') RETURNING id, username",
    );
    for (const row of result.rows) {
      await pool.query(
        "INSERT INTO internal_credentials(user_id, password_hash) VALUES ($1,$2)",
        [row.id, hash],
      );
      if (row.username === "admin") adminId = row.id;
      else employeeId = row.id;
    }
    api = spawn(process.execPath, [resolve("dist/apps/api/src/main.js")], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: url,
        PORT: "3131",
        BACKUP_DIR: resolve("../../var/integration-backups"),
        WEB_DIST_DIR: "",
        INTERNET_PROBE_URL: "http://127.0.0.1:1",
      },
      stdio: "pipe",
    });
    let output = "";
    api.stdout?.on("data", (d) => (output += d.toString()));
    api.stderr?.on("data", (d) => (output += d.toString()));
    for (let n = 0; n < 100; n++) {
      try {
        if ((await fetch(base + "/health")).ok) break;
      } catch {
        /* wait for Nest */
      }
      if (api.exitCode !== null) throw new Error(output);
      await new Promise((r) => setTimeout(r, 100));
    }
    const a = await request("/auth/login", "", {
      username: " ADMIN ",
      password: "PruebaRamax123",
    });
    expect(a.status).toBe(201);
    admin = a.cookie;
    const e = await request("/auth/login", "", {
      username: "lucia",
      password: "PruebaRamax123",
    });
    expect(e.status).toBe(201);
    employee = e.cookie;
  }, 30000);
  afterAll(async () => {
    api?.kill();
    await pool.end();
  });
  it("protege personal, usuarios únicos y último administrador", async () => {
    expect((await request("/staff", employee)).status).toBe(403);
    expect((await request("/backups", employee)).status).toBe(403);
    expect((await request("/backups", admin)).status).toBe(200);
    expect(
      (
        await request("/staff", admin, {
          username: "lucia",
          displayName: "Otra",
          role: "employee",
          password: "PruebaRamax123",
        })
      ).status,
    ).toBe(409);
    expect(
      (await request(`/staff/${adminId}/deactivate`, admin, {})).status,
    ).toBe(409);
    const staff = await request("/staff", admin);
    expect(staff.body).toHaveLength(2);
    expect(JSON.stringify(staff.body)).not.toContain("password");
  });
  it("crea catálogo en cero, audita y ajusta una sola vez", async () => {
    const body = {
      name: "Café",
      sku: "CAFE-TEST",
      priceArs: 1000,
      tracksStock: true,
      minimumQuantity: 1,
    };
    expect((await request("/products", employee, body)).status).toBe(403);
    const p = await request("/products", admin, body);
    expect(p.status).toBe(201);
    productId = p.body.id;
    expect(p.body.quantity).toBe(0);
    expect((await request("/products", admin, body)).status).toBe(409);
    const invalid = await request("/products", admin, {
      ...body,
      initialQuantity: 10,
    });
    expect(invalid.status).toBe(400);
    const key = randomUUID();
    const adjustment = { productId, delta: 5, reason: "Recepción inicial" };
    const [one, two] = await Promise.all([
      request("/inventory/adjustments", admin, adjustment, key),
      request("/inventory/adjustments", admin, adjustment, key),
    ]);
    expect(one.status).toBe(201);
    expect(two.body).toEqual(one.body);
    expect(
      (
        await pool.query(
          "SELECT quantity FROM inventory_balances WHERE product_id=$1",
          [productId],
        )
      ).rows[0].quantity,
    ).toBe(5);
    expect(
      (await request("/inventory/adjustments", employee, adjustment)).status,
    ).toBe(403);
    expect(
      (
        await request("/inventory/adjustments", admin, {
          ...adjustment,
          delta: -6,
        })
      ).status,
    ).toBe(400);
    await expect(
      pool.query(
        "UPDATE inventory_balances SET quantity=-1 WHERE product_id=$1",
        [productId],
      ),
    ).rejects.toThrow();
  });
  let saleId = "";
  it("valida pago, cambio de precio y rollback", async () => {
    const input = {
      items: [{ productId, quantity: 1 }],
      expectedTotalArs: 1000,
    };
    expect((await request("/sales", employee, input)).status).toBe(400);
    expect(
      (await request("/sales", employee, { ...input, paymentMethod: "card" }))
        .status,
    ).toBe(400);
    expect(
      (
        await request("/sales", employee, {
          ...input,
          paymentMethod: "transfer",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/sales", employee, {
          ...input,
          paymentMethod: "cash",
          expectedTotalArs: 900,
        })
      ).body.code,
    ).toBe("PRICE_CHANGED");
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM sales")).rows[0].n,
    ).toBe(0);
  });
  it("deduplica doble envío, recupera respuesta perdida y rechaza cambio del pedido", async () => {
    const key = randomUUID();
    const input = {
      items: [{ productId, quantity: 2 }],
      expectedTotalArs: 2000,
      paymentMethod: "cash",
    };
    const [one, two] = await Promise.all([
      request("/sales", employee, input, key),
      request("/sales", employee, input, key),
    ]);
    expect(one.status).toBe(201);
    expect(two.body).toEqual(one.body);
    saleId = one.body.saleId;
    expect(one.body.saleNumber).toBeGreaterThan(0);
    expect((await request("/sales", employee, input, key)).body).toEqual(
      one.body,
    );
    expect(
      (
        await request(
          "/sales",
          employee,
          { ...input, expectedTotalArs: 3000 },
          key,
        )
      ).body.code,
    ).toBe("IDEMPOTENCY_CONFLICT");
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM payments")).rows[0].n,
    ).toBe(1);
  });
  it("rechaza reintentos vencidos conservando la venta original", async () => {
    const [stored] = (
      await pool.query(
        "SELECT key FROM idempotency_keys WHERE scope='sales.close' AND actor_user_id=$1 LIMIT 1",
        [employeeId],
      )
    ).rows;
    await pool.query(
      "UPDATE idempotency_keys SET expires_at=now()-interval '1 second', response=NULL WHERE scope='sales.close' AND key=$1",
      [stored.key],
    );
    const response = await request(
      "/sales",
      employee,
      {
        items: [{ productId, quantity: 2 }],
        expectedTotalArs: 2000,
        paymentMethod: "cash",
      },
      stored.key,
    );
    expect(response.body.code).toBe("IDEMPOTENCY_EXPIRED");
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM sales")).rows[0].n,
    ).toBe(1);
  });
  it("cierres concurrentes no sobrevendan ni dejan registros parciales", async () => {
    const input = {
      items: [{ productId, quantity: 2 }],
      expectedTotalArs: 2000,
      paymentMethod: "transfer",
      transferConfirmed: true,
    };
    const results = await Promise.all([
      request("/sales", employee, input),
      request("/sales", employee, input),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (
        await pool.query(
          "SELECT quantity FROM inventory_balances WHERE product_id=$1",
          [productId],
        )
      ).rows[0].quantity,
    ).toBe(1);
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM sales")).rows[0].n,
    ).toBe(2);
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM payments")).rows[0].n,
    ).toBe(2);
  });
  it("conserva precios históricos, pagina, imprime y anula una vez", async () => {
    expect(
      (
        await request(
          `/products/${productId}`,
          admin,
          { priceArs: 1500 },
          randomUUID(),
          "PATCH",
        )
      ).status,
    ).toBe(200);
    const receipt = await request(`/sales/${saleId}/receipt`, employee);
    expect(receipt.body.items[0].unitPriceArs).toBe(1000);
    const list = await request(
      "/sales?page=1&pageSize=1&paymentMethod=cash",
      employee,
    );
    expect(list.body.items).toHaveLength(1);
    expect(list.body.total).toBe(1);
    const input = { reason: "Venta incorrecta", refundConfirmed: true };
    expect(
      (await request(`/sales/${saleId}/void`, employee, input)).status,
    ).toBe(403);
    expect(
      (await request(`/sales/${saleId}/void`, admin, { reason: "Error" }))
        .status,
    ).toBe(400);
    const key = randomUUID();
    const results = await Promise.all([
      request(`/sales/${saleId}/void`, admin, input, key),
      request(`/sales/${saleId}/void`, admin, input, key),
    ]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(
      (await request(`/sales/${saleId}/void`, admin, input)).body.code,
    ).toBe("SALE_ALREADY_VOID");
    expect(
      (
        await pool.query(
          "SELECT quantity FROM inventory_balances WHERE product_id=$1",
          [productId],
        )
      ).rows[0].quantity,
    ).toBe(3);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM stock_movements WHERE type='sale_reversal'",
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("revoca sesiones al restablecer, desactivar y vencer", async () => {
    expect(
      (
        await request(`/staff/${employeeId}/password`, admin, {
          password: "NuevaClave123",
        })
      ).status,
    ).toBe(201);
    expect((await request("/auth/me", employee)).body.authenticated).toBe(
      false,
    );
    const login = await request("/auth/login", "", {
      username: "lucia",
      password: "NuevaClave123",
    });
    employee = login.cookie;
    await pool.query(
      "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",
      [employeeId],
    );
    expect((await request("/auth/me", employee)).body.authenticated).toBe(
      false,
    );
    employee = (
      await request("/auth/login", "", {
        username: "lucia",
        password: "NuevaClave123",
      })
    ).cookie;
    expect(
      (await request(`/staff/${employeeId}/deactivate`, admin, {})).status,
    ).toBe(201);
    expect((await request("/auth/me", employee)).body.authenticated).toBe(
      false,
    );
    expect(
      (
        await request("/auth/login", "", {
          username: "lucia",
          password: "NuevaClave123",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM audit_events WHERE action='staff.password_reset'",
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("cierra sesión con respuesta vacía explícita", async () => {
    expect((await request("/auth/logout", admin, {})).status).toBe(204);
    expect((await request("/auth/me", admin)).body.authenticated).toBe(false);
  });
});
