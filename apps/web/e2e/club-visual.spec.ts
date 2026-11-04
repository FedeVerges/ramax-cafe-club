import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 844 }]) {
  test(`club de maquetas ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const base = "/maquetas/club";
    const headings: Record<string, string> = {
      acceso: "Más que café,buenos momentos",
      inicio: "Hola, Juan",
      beneficios: "Beneficios",
      detalle: "Una medialuna clásica",
      confirmar: "Confirmá tu canje",
      ticket: "Tu canje está listo",
      canjes: "Mis canjes",
      movimientos: "Tus puntos",
      "saldo-negativo": "Tus puntos",
      compras: "Mis compras",
      cuenta: "Mi cuenta",
    };
    async function capture(name: string) {
      await expect(page).toHaveURL(`${base}/${name}`);
      if (name === "cancelar") await expect(page.getByRole("dialog", { name: "Cancelar este canje" })).toBeVisible();
      else if (name === "acceso") await expect(page.locator(".club-access h1")).toHaveText(headings[name]);
      else await expect(page.locator(".club-body > h1")).toHaveText(headings[name]);
      await page.evaluate(() => document.fonts.ready);
      await page.locator("img").evaluateAll(async (images) => { await Promise.all(images.map((image) => (image as HTMLImageElement).decode().catch(() => {}))); });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `/tmp/ramax-club-${viewport.width}-${name}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name).toBe(true);
    }
    await page.goto(`${base}/acceso`);
    await capture("acceso");
    await page.getByRole("button", { name: /Continuar con Google/ }).click();
    await expect(page.getByRole("heading", { name: "Hola, Juan" })).toBeVisible();
    await capture("inicio");
    await page.getByRole("button", { name: /Ver recompensas/ }).click();
    await capture("beneficios");
    await page.getByRole("button", { name: /Ver beneficio/ }).first().click();
    await capture("detalle");
    await page.getByRole("button", { name: "Continuar al canje" }).click();
    await capture("confirmar");
    await page.getByRole("button", { name: /Confirmar canje/ }).click();
    await capture("ticket");
    await page.getByRole("button", { name: "Cancelar canje" }).click();
    await capture("cancelar");
    await page.getByRole("dialog").getByRole("button", { name: "Sí, cancelar canje" }).click();
    await expect(page.getByRole("heading", { name: "Canje cancelado" })).toBeVisible();
    await page.getByRole("navigation", { name: "Navegación del club" }).getByRole("link", { name: "Inicio" }).click();
    await expect(page.locator(".club-points-card strong").first()).toHaveText("120");
    await page.getByRole("navigation", { name: "Navegación del club" }).getByRole("link", { name: "Mi cuenta" }).click();
    await page.getByRole("link", { name: "Mis canjes" }).click();
    await expect(page.locator(".club-redeem-card")).toHaveCount(0);
    await page.getByRole("button", { name: "Activos" }).click();
    await expect(page.getByText("No tenés canjes activos.")).toBeVisible();
    await page.goto(`${base}/canjes`); await capture("canjes");
    await page.goto(`${base}/movimientos`); await capture("movimientos");
    await page.getByRole("button", { name: "Ver ejemplo de saldo negativo" }).click(); await capture("saldo-negativo");
    await page.goto(`${base}/compras`); await capture("compras");
    await page.goto(`${base}/cuenta`); await capture("cuenta");
    expect(errors).toEqual([]);
  });
}
