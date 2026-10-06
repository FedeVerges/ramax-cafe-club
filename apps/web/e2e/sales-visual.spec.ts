import { test, expect } from "@playwright/test";
import type { SaleProduct, SaleDetail } from "@ramax/contracts";
import { resolve } from "node:path";
// Browser fixtures only; these records are never added to the application.
const before = Boolean(process.env.RAMAX_BEFORE);
const products: SaleProduct[] = [
  { id: "1", name: "Cappuccino", priceArs: 4500, category: "Cafés", quantity: 3 },
  { id: "2", name: "Medialuna", priceArs: 2500, category: "Comida", quantity: 8 },
  { id: "3", name: "Café con leche", priceArs: 4000, category: "Cafés", quantity: 5 },
  { id: "4", name: "Tostado", priceArs: 6000, category: "Comida", quantity: 3 },
].map((p) => ({ ...p, sku: null, tracksStock: true, status: "active", minimumQuantity: 0 }));
const sale: SaleDetail = {
  id: "248", saleNumber: 248, status: "closed", totalArs: 11500,
  createdAt: "2026-10-04T16:32:00.000Z", paymentMethod: "cash", responsible: "Lucía",
  voidedAt: null, voidedBy: null, voidReason: null,
  items: [
    { productName: "Cappuccino", quantity: 2, unitPriceArs: 4500, subtotalArs: 9000 },
    { productName: "Medialuna", quantity: 1, unitPriceArs: 2500, subtotalArs: 2500 },
  ],
};
for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 1440, height: 1024 }]) {
  test(`flujo visual ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const requests: string[] = [];
    let method = "cash";
    let voided = false;
    let role = "admin";
    let loseResponse = true;
    const saleKeys: string[] = [];
    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      requests.push(url.pathname + url.search);
      let body: unknown;
      if (url.pathname.endsWith("/auth/me")) body = { authenticated: true, user: { id: "admin", displayName: "Lucía", primaryRole: role, roles: [role], permissions: [] }, homePath: "/operacion" };
      else if (url.pathname.endsWith("/health")) body = { internet: true };
      else if (url.pathname.endsWith("/products")) body = products;
      else if (url.pathname.endsWith("/void")) { voided = true; body = {}; }
      else if (url.pathname.endsWith("/sales/248")) body = { ...sale, paymentMethod: method, ...(voided ? { status: "void", voidedBy: "Lucía", voidReason: "Venta duplicada", voidedAt: sale.createdAt } : {}) };
      else if (route.request().method() === "POST") {
        saleKeys.push(route.request().headers()["idempotency-key"]!);
        if (loseResponse) { loseResponse = false; await route.abort("failed"); return; }
        const input = route.request().postDataJSON();
        expect(input.expectedTotalArs).toBe(11500);
        expect(input.items).toEqual([{ productId: "1", quantity: 2 }, { productId: "2", quantity: 1 }]);
        method = input.paymentMethod;
        body = { saleId: "248", saleNumber: 248, totalArs: 11500, status: "closed" };
      } else body = { items: [sale, { ...sale, id: "247", saleNumber: 247, totalArs: 8500, paymentMethod: "transfer" }, { ...sale, id: "246", saleNumber: 246, createdAt: "2026-10-03T21:18:00Z" }], page: 1, pageSize: 20, total: 21 };
      await route.fulfill({ json: body });
    });
    async function capture(name: string) {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: resolve(`../../docs/design/comparisons/${before ? "before" : "after"}-${viewport.width}-${name}.png`) });
      if (!before) expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto("/operacion");
    await page.waitForLoadState("networkidle");
    if (before) {
      const add = page.locator("article").filter({ hasText: "Cappuccino" }).getByRole("button", { name: "Agregar", exact: true });
      await add.click(); await add.click();
      await page.locator("article").filter({ hasText: "Medialuna" }).getByRole("button", { name: "Agregar", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Agregar Cappuccino", exact: true }).click();
      await page.getByRole("button", { name: "Agregar Cappuccino", exact: true }).click();
      await page.getByRole("button", { name: "Agregar Cappuccino", exact: true }).click();
      await expect(page.getByRole("button", { name: "Agregar Cappuccino", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Quitar Cappuccino", exact: true }).click();
      await page.getByRole("button", { name: "Agregar Medialuna", exact: true }).click();
      const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
      expect(fonts).toContain("Cormorant Garamond"); expect(fonts).toContain("Space Grotesk");
      expect(await page.locator(".sales-quantity button").evaluateAll((nodes) => nodes.every((n) => n.getBoundingClientRect().width >= 44 && n.getBoundingClientRect().height >= 44))).toBe(true);
    }
    await page.evaluate(() => scrollTo(0, 0)); await capture("products");
    await page.getByRole("button", { name: before ? "Revisar venta" : "Ver pedido", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0)); await capture("review");
    await page.getByRole("button", { name: "Continuar al cobro" }).click();
    await page.evaluate(() => scrollTo(0, 0)); await capture("payment");
    if (before) await page.getByLabel("Medio de pago").selectOption("transfer");
    else await page.getByRole("radio", { name: "Transferencia" }).check();
    await expect(page.getByRole("button", { name: /Confirmar cobro/ })).toBeDisabled();
    await page.getByLabel("Confirmo que recibí la transferencia").check();
    await capture("transfer");
    if (before) await page.getByLabel("Medio de pago").selectOption("cash");
    else await page.getByRole("radio", { name: "Efectivo" }).check();
    await page.getByRole("button", { name: /Confirmar cobro/ }).click();
    await expect(page.getByRole("button", { name: "Reintentar el mismo cobro" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar el mismo cobro" }).click();
    expect(saleKeys).toHaveLength(2);
    expect(saleKeys[0]).toBe(saleKeys[1]);
    await expect(page.getByRole("heading", { name: /Venta N.º/ })).toBeVisible();
    await page.evaluate(() => scrollTo(0, 0)); await capture("registered");
    await page.getByRole("link", { name: "Ver e imprimir comprobante" }).click();
    await expect(page.getByText("Comprobante sin validez fiscal")).toBeVisible(); await capture("detail");
    await page.evaluate(() => { window.print = () => { document.body.dataset.printed = "true"; }; });
    await page.getByRole("button", { name: "Imprimir comprobante" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-printed", "true");
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: resolve(`../../docs/design/comparisons/${before ? "before" : "after"}-${viewport.width}-receipt.pdf`), width: "80mm", height: "180mm" });
    await page.emulateMedia({ media: "screen" });
    await expect(page.getByRole("button", { name: "Confirmar anulación" })).toBeDisabled();
    await page.getByLabel("Motivo", { exact: true }).fill("Venta duplicada");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Confirmar anulación" }).click();
    await expect(page.getByText(/Anulada por/)).toBeVisible();
    await page.goto("/ventas");
    await expect(page.getByText("Página 1", { exact: false })).toBeVisible(); await capture("history");
    await page.getByLabel("Número", { exact: true }).fill("248");
    if (!before) await page.getByText("Fechas y filtros", { exact: true }).click();
    await page.getByRole("button", { name: "Filtrar", exact: true }).click();
    await expect.poll(() => requests.some((r) => r.includes("number=248"))).toBe(true);
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect.poll(() => requests.some((r) => r.includes("page=2"))).toBe(true);
    if (!before) {
      await page.goto("/operacion");
      await page.getByRole("button", { name: "Comida", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Cappuccino", exact: true })).toHaveCount(0);
      await page.getByLabel("Buscar producto").fill("Tostado");
      await expect(page.locator(".sales-product")).toHaveCount(1);
      await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
      if (viewport.width <= 390) {
        await page.getByText("Más", { exact: true }).click();
        for (const name of ["Productos", "Inventario", "Equipo", "Copias de seguridad"]) await expect(page.locator(".sales-mobile-menu").getByRole("link", { name, exact: true })).toBeVisible();
      }
    }
    role = "employee";
    voided = false;
    await page.reload();
    await page.goto("/ventas/248");
    await expect(page.getByRole("heading", { name: "Detalle de la venta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar anulación" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("listado: filtros, anuladas, vacío y recuperación de errores", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: URL[] = [];
  let fail = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/me")) {
      return route.fulfill({ json: { authenticated: true, user: { id: "employee", displayName: "Lucía", primaryRole: "employee", roles: ["employee"], permissions: [] }, homePath: "/operacion" } });
    }
    if (url.pathname.endsWith("/health")) return route.fulfill({ json: { internet: false } });
    if (url.pathname.endsWith("/sales")) {
      requests.push(url);
      if (fail) return route.fulfill({ status: 503, json: { message: "Servidor temporalmente no disponible." } });
      const items = [sale, { ...sale, id: "247", saleNumber: 247, status: "void", paymentMethod: "transfer", responsible: "María Fernández" }].filter((item) => (!url.searchParams.get("number") || item.saleNumber === Number(url.searchParams.get("number"))) && (!url.searchParams.get("status") || item.status === url.searchParams.get("status")) && (!url.searchParams.get("paymentMethod") || item.paymentMethod === url.searchParams.get("paymentMethod")));
      return route.fulfill({ json: { items, page: 1, pageSize: 20, total: items.length } });
    }
    return route.fulfill({ status: 404, json: { message: "Fixture inexistente" } });
  });
  await page.goto("/ventas");
  await expect(page.locator(".sales-history-item")).toHaveCount(2);
  await expect(page.locator(".sales-history-state--void")).toHaveText("Anulada");
  await page.screenshot({ path: resolve("../../docs/design/comparisons/listing-states-390.png") });
  await page.getByText("Fechas y filtros", { exact: true }).click();
  await page.getByLabel("Desde", { exact: true }).fill("2026-10-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-10-05");
  await page.getByLabel("Estado", { exact: true }).selectOption("void");
  await page.getByLabel("Pago", { exact: true }).selectOption("transfer");
  await page.screenshot({ path: resolve("../../docs/design/comparisons/listing-filters-390.png") });
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.locator(".sales-filter-options")).not.toHaveAttribute("open", "");
  await expect(page.locator(".sales-history-item")).toHaveCount(1);
  await expect(page.getByLabel("Filtros aplicados")).toContainText("Anuladas");
  await page.screenshot({ path: resolve("../../docs/design/comparisons/listing-applied-390.png") });
  expect(requests.at(-1)?.searchParams.get("from")).toBe("2026-10-01T00:00:00-03:00");
  expect(requests.at(-1)?.searchParams.get("to")).toBe("2026-10-05T23:59:59.999-03:00");
  await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click();
  await expect(page.locator(".sales-history-item")).toHaveCount(2);
  await expect(page.getByLabel("Filtros aplicados")).toHaveCount(0);
  await page.getByLabel("Número", { exact: true }).fill("999");
  await page.getByRole("button", { name: "Buscar venta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sin resultados" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Paginación de ventas" })).toHaveCount(0);
  await page.screenshot({ path: resolve("../../docs/design/comparisons/listing-empty-390.png") });
  await page.getByLabel("Filtros aplicados").getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page.locator(".sales-history-item")).toHaveCount(2);
  fail = true;
  await page.getByLabel("Número", { exact: true }).fill("248");
  await page.getByRole("button", { name: "Buscar venta", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Servidor temporalmente no disponible");
  await expect(page.locator(".sales-history-item")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.locator(".sales-history-item")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
