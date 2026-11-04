import { test, expect } from "@playwright/test";

const pages = [
  ["equipo", "caja"],
  ["equipo", "productos-venta"],
  ["equipo", "revisar-venta"],
  ["equipo", "cobrar-venta"],
  ["equipo", "venta-registrada"],
  ["equipo", "ventas"],
  ["equipo", "detalle-venta"],
  ["equipo", "buscar-socio"],
  ["equipo", "socio-sin-conexion"],
  ["equipo", "asociar"],
  ["equipo", "canjes"],
  ["equipo", "codigo-inexistente"],
  ["equipo", "ticket-vencido"],
  ["equipo", "ticket-cancelado"],
  ["equipo", "ticket-utilizado"],
  ["equipo", "entregar"],
  ["equipo", "cancelar"],
  ["campanias", "listado"],
  ["campanias", "nueva"],
  ["campanias", "beneficio"],
  ["campanias", "datos"],
  ["campanias", "resultados"],
] as const;

for (const width of [390, 320]) {
  test(`maquetas móviles ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [area, screen] of pages) {
      await page.goto(`/maquetas/${area}/${screen}`);
      await expect(page).toHaveURL(`/maquetas/${area}/${screen}`);
      await expect(page.locator(".demo-mobile__body h1").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${area}/${screen}`).toBe(true);
      await page.screenshot({ path: `/tmp/ramax-demo-${width}-${area}-${screen}.png` });
    }
    expect(errors).toEqual([]);
  });
}

test("campaña: editar, guardar y filtrar borrador", async ({ page }) => {
  await page.goto("/maquetas/campanias/listado");
  await page.getByRole("button", { name: /Nueva campaña/ }).click();
  await page.getByLabel("Nombre de la campaña").fill("Semana de la medialuna");
  await page.getByRole("button", { name: /Continuar al beneficio/ }).click();
  await page.getByRole("button", { name: /Recompensa/ }).click();
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await page.getByRole("button", { name: "Borradores" }).click();
  await expect(page.getByText("Semana de la medialuna")).toBeVisible();
  await expect(page.getByText("Octubre con Ramax")).toHaveCount(0);
});

test("equipo: buscar y cancelar ticket", async ({ page }) => {
  await page.goto("/maquetas/equipo/canjes");
  await page.getByRole("button", { name: "Buscar ticket" }).click();
  await expect(page.getByRole("heading", { name: "Entregar beneficio" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar ticket" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Sí, cancelar ticket" }).click();
  await expect(page.getByText("CANCELADO")).toBeVisible();
});

test("equipo: registrar una venta de ejemplo", async ({ page }) => {
  await page.goto("/maquetas/equipo/caja");
  await page.getByRole("button", { name: /Nueva venta/ }).click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("button", { name: /Continuar al cobro/ }).click();
  await page.getByRole("button", { name: /Confirmar venta/ }).click();
  await expect(page.getByRole("heading", { name: "Venta registrada" })).toBeVisible();
  await page.getByRole("button", { name: /Imprimir comprobante/ }).click();
  await expect(page.getByRole("heading", { name: "Venta N.º 248" })).toBeVisible();
});

test("índice: 39 pantallas accesibles", async ({ page }) => {
  await page.goto("/maquetas");
  await expect(page.getByRole("heading", { name: "Maquetas interactivas" })).toBeVisible();
  await expect(page.locator(".mockup-index__groups a")).toHaveCount(39);
  await page.getByRole("link", { name: /10b · Confirmar cancelación/ }).first().click();
  await expect(page).toHaveURL("/maquetas/equipo/cancelar");
});
