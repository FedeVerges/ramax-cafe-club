import { test, expect } from "@playwright/test";
import type { SaleProduct, StaffUser, StockMovement } from "@ramax/contracts";

const products: SaleProduct[] = [
  { id: "cappuccino", name: "Cappuccino", sku: null, category: "Bebidas calientes", priceArs: 4500, tracksStock: true, status: "active", quantity: 24, minimumQuantity: 0 },
  { id: "medialuna", name: "Medialuna clásica", sku: null, category: "Panadería", priceArs: 2500, tracksStock: true, status: "active", quantity: 12, minimumQuantity: 0 },
  { id: "americano", name: "Café americano", sku: null, category: "Bebidas calientes", priceArs: 3000, tracksStock: true, status: "active", quantity: 18, minimumQuantity: 0 },
];
const staff: StaffUser[] = [
  { id: "ana", displayName: "Ana", username: "ana", role: "admin", active: true },
  { id: "lucia", displayName: "Lucía", username: "lucia", role: "employee", active: true },
  { id: "marcos", displayName: "Marcos", username: "marcos", role: "employee", active: false },
];
const movements: StockMovement[] = [
  { id: "m1", productId: "medialuna", productName: "Medialuna clásica", delta: 24, balanceAfter: 24, reason: "Recepción de mercadería", createdAt: "2026-10-03T13:00:00Z", responsible: "Ana" },
  { id: "m2", productId: "medialuna", productName: "Medialuna clásica", delta: -2, balanceAfter: 22, reason: "Merma por rotura", createdAt: "2026-10-02T13:00:00Z", responsible: "Ana" },
];

for (const viewport of [{ width: 1440, height: 1024 }, { width: 390, height: 844 }]) {
  test(`administración visual ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/auth/me")) return route.fulfill({ json: { authenticated: true, user: { id: "ana", displayName: "Ana", primaryRole: "admin", roles: ["admin"], permissions: [] }, homePath: "/admin" } });
      if (path.endsWith("/health")) return route.fulfill({ json: { internet: true } });
      if (path.endsWith("/staff")) return route.fulfill({ json: staff });
      if (path.endsWith("/products")) return route.fulfill({ json: products });
      if (path.endsWith("/inventory/movements")) return route.fulfill({ json: movements });
      if (path.endsWith("/backups")) return route.fulfill({ json: { backups: [
        { id: "b1", createdAt: "2026-10-04T06:00:00Z", status: "valid", schemaVersion: "0002" },
        { id: "b2", createdAt: "2026-10-03T06:00:00Z", status: "valid", schemaVersion: "0002" },
        { id: "b3", createdAt: "2026-10-02T06:00:00Z", status: "valid", schemaVersion: "0002" },
      ], jobs: [], maintenance: false } });
      return route.fulfill({ status: 404, json: { message: "Sin fixture" } });
    });
    for (const [route, name] of [["/equipo", "staff"], ["/productos", "products"], ["/inventario", "inventory"], ["/copias", "backups"]] as const) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(".admin-heading h1")).toBeVisible();
      await page.screenshot({ path: `/tmp/ramax-admin-${viewport.width}-${name}.png` });
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, elements: [...document.querySelectorAll("body *")].map((node) => ({ node, rect: node.getBoundingClientRect() })).filter(({ rect }) => rect.right > innerWidth + 1 && rect.left < innerWidth).sort((a, b) => b.rect.right - a.rect.right).slice(0, 12).map(({ node, rect }) => `${node.tagName}.${typeof node.className === "string" ? node.className : ""} ${Math.round(rect.left)}-${Math.round(rect.right)}`) }));
      expect(overflow.width, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
    }
    expect(errors).toEqual([]);
  });
}

test("administración de ejemplo: acceso y cambios locales", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/maquetas/admin/acceso");
  await expect(page.getByRole("heading", { name: "Acceso del equipo" })).toBeVisible();
  await page.screenshot({ path: "/tmp/ramax-admin-1440-login.png" });
  await page.getByLabel("Usuario").fill("ana");
  await page.getByLabel("Contraseña", { exact: true }).fill("ejemplo123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Equipo" })).toBeVisible();
  await page.getByPlaceholder("Buscar por nombre o usuario...").fill("Lucía");
  await expect(page.locator(".admin-staff__table tbody tr")).toHaveCount(1);
  await page.getByPlaceholder("Buscar por nombre o usuario...").fill("");
  await page.getByRole("link", { name: "Productos" }).click();
  await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();
  await page.getByRole("button", { name: /Nuevo producto/ }).click();
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Cookie de chocolate");
  await page.getByRole("textbox", { name: "Categoría" }).fill("Panadería");
  await page.getByRole("spinbutton", { name: "Precio" }).fill("2200");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByText("Cookie de chocolate")).toBeVisible();
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar ajuste" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  await page.getByRole("link", { name: "Copias de seguridad" }).click();
  await expect(page.getByRole("heading", { name: "Copias de seguridad" })).toBeVisible();
  await page.goto("/maquetas/admin/ventas/248");
  await expect(page.getByRole("heading", { name: "Venta N.º 248" })).toBeVisible();
});
