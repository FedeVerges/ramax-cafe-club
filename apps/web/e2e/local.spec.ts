import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const productName = `Café E2E ${Date.now()}`;
test("prepara catálogo, vende sin internet, imprime y anula", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Usuario", { exact: true }).fill("e2e_admin");
  await page.getByLabel("Contraseña", { exact: true }).fill("PruebaRamax123");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill(productName);
  await page.getByLabel("Precio en ARS").fill("1500");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cambios guardados" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await page.getByRole("button").filter({ hasText: productName }).click();
  await page.getByLabel("Cantidad", { exact: true }).fill("5");
  await page.getByLabel("Motivo", { exact: true }).fill("Recepción E2E");
  await page.getByRole("button", { name: "Confirmar ajuste" }).click();
  await expect(
    page
      .getByRole("button")
      .filter({ hasText: productName })
      .filter({ hasText: "5 unidades" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByLabel("Usuario", { exact: true }).fill("e2e_employee");
  await page.getByLabel("Contraseña", { exact: true }).fill("PruebaRamax123");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Equipo", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Buscar producto").fill(productName);
  await page
    .locator("article")
    .filter({ hasText: productName })
    .getByRole("button", { name: "Agregar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Revisar venta", exact: true })
    .click();
  await page.getByRole("button", { name: "Continuar al cobro" }).click();
  await page.getByLabel("Medio de pago").selectOption("transfer");
  await expect(
    page.getByRole("button", { name: "Confirmar cobro" }),
  ).toBeDisabled();
  await page.getByLabel("Confirmo que recibí la transferencia").check();
  // Lose the first response after the API committed. The retry must use exactly the same key.
  let intercepted = false;
  const keys: string[] = [];
  await page.route("**/api/v1/sales", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (!intercepted) {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Confirmar cobro" }).click();
  await page.getByRole("button", { name: "Reintentar el mismo cobro" }).click();
  await expect(page.getByRole("heading", { name: /Venta N.º/ })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.getByRole("link", { name: "Ver e imprimir comprobante" }).click();
  await expect(page.getByText("Comprobante sin validez fiscal")).toBeVisible();
  const saleUrl = page.url();
  await page.screenshot({ path: "test-results/ticket.png", fullPage: true });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: "test-results/ticket-80mm.pdf",
    width: "80mm",
    height: "180mm",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await expect(
    page.getByRole("button", { name: "Confirmar anulación" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByLabel("Usuario", { exact: true }).fill("e2e_admin");
  await page.getByLabel("Contraseña", { exact: true }).fill("PruebaRamax123");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/operacion$/);
  await page.goto(saleUrl);
  await page.getByLabel("Motivo", { exact: true }).fill("Anulación de prueba");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.getByText(/Anulada por/)).toBeVisible();
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await expect(
    page
      .getByRole("button")
      .filter({ hasText: productName })
      .filter({ hasText: "5 unidades" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Caja", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "test-results/caja-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("administra una cuenta y revoca su acceso", async ({ page, browser }) => {
  const username = `equipo_${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Usuario", { exact: true }).fill("e2e_admin");
  await page.getByLabel("Contraseña", { exact: true }).fill("PruebaRamax123");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByRole("link", { name: "Equipo", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Personal de prueba");
  await page.getByLabel("Usuario", { exact: true }).fill(username);
  await page.getByLabel("Contraseña inicial").fill("Inicial123");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: username });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Restablecer contraseña" }).click();
  await page.getByLabel("Nueva contraseña").fill("Restablecida123");
  await page
    .locator("form")
    .getByRole("button", { name: "Restablecer contraseña", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Agregar persona" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/equipo-desktop.png",
    fullPage: true,
  });
  const employeeContext = await browser.newContext();
  const employeePage = await employeeContext.newPage();
  await employeePage.goto("http://127.0.0.1:3133/login");
  await employeePage.getByLabel("Usuario", { exact: true }).fill(username);
  await employeePage
    .getByLabel("Contraseña", { exact: true })
    .fill("Restablecida123");
  await employeePage
    .getByRole("button", { name: "Ingresar", exact: true })
    .click();
  await expect(employeePage).toHaveURL(/\/operacion$/);
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Desactivar", exact: true }).click();
  await expect(
    row.getByRole("cell", { name: "Inactiva", exact: true }),
  ).toBeVisible();
  await employeePage.reload();
  await expect(employeePage).toHaveURL(/\/login$/);
  await employeeContext.close();
});
