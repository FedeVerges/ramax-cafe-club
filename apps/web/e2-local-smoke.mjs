import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = "http://localhost:5173";
const localApi = "http://localhost:3133/api/v1";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const errors = [];

try {
  const club = await context.newPage();
  club.on("pageerror", (error) => errors.push(error.message));
  await club.goto(`${origin}/club/acceso`);
  await club.waitForLoadState("networkidle");
  await club.getByLabel("Código de acceso de prueba").fill(process.env.PILOT_MEMBER_ACCESS_CODE);
  await club.getByRole("button", { name: "Entrar como socio de prueba" }).click();
  await club.getByRole("heading", { name: "Hola, Socio" }).waitFor();
  const memberNumber = (await club.locator(".club-header__member strong").textContent()).trim();
  const accountUrl = `${origin}/api/v1/club/points`;
  const initialBalance = (await (await club.request.get(accountUrl)).json()).confirmedBalance;
  assert.match(memberNumber, /^\d{6}$/);

  const staff = await context.newPage();
  staff.on("pageerror", (error) => errors.push(error.message));
  await staff.goto(`${origin}/login`);
  await staff.getByLabel("Usuario", { exact: true }).fill("admin");
  await staff.getByLabel("Contraseña", { exact: true }).fill("PruebaRamax123");
  await staff.getByRole("button", { name: "Ingresar", exact: true }).click();
  try {
    await staff.getByRole("link", { name: "Club Ramax" }).waitFor({ timeout: 10000 });
  } catch {
    throw new Error(`El acceso laboral no avanzó: ${(await staff.locator("body").innerText()).slice(0, 700)}`);
  }
  await staff.getByRole("link", { name: "Club Ramax" }).click();
  await staff.getByRole("heading", { name: "Regla de puntos" }).waitFor();

  const ruleUrl = `${localApi}/club-admin/point-rule`;
  let rule = await (await staff.request.get(ruleUrl)).json();
  if (rule.active?.pesosPorPunto !== 100) {
    await staff.getByLabel("Nuevo valor de pesos por punto").fill("100");
    await staff.getByRole("button", { name: "Cambiar regla" }).click();
    await staff.getByText("Próxima regla:").waitFor();
    for (let attempt = 0; attempt < 40; attempt++) {
      await staff.waitForTimeout(2000);
      rule = await (await staff.request.get(ruleUrl)).json();
      if (rule.active?.pesosPorPunto === 100) break;
    }
  }
  assert.equal(rule.active?.pesosPorPunto, 100, "La regla del piloto no se activó");

  await staff.getByRole("link", { name: "Caja", exact: true }).click();
  const product = staff.locator("article.sales-product").filter({ hasText: "Combo" });
  try {
    await product.getByRole("button", { name: "Agregar Combo" }).click({ timeout: 7000 });
  } catch {
    throw new Error(`La caja no mostró Combo en ${staff.url()}: ${(await staff.locator("body").innerText()).slice(0, 1200)}`);
  }
  await staff.getByRole("button", { name: "Ver pedido" }).click();
  await staff.getByLabel("Número de socio").fill(memberNumber);
  await staff.getByRole("button", { name: "Buscar", exact: true }).click();
  await staff.locator(".sales-member__result").getByText("Socio de prueba").waitFor();
  await staff.getByRole("button", { name: "Continuar al cobro" }).click();
  await staff.getByRole("button", { name: /Confirmar cobro/ }).click();
  await staff.getByRole("heading", { name: "Venta registrada" }).waitFor();
  await staff.getByText("115 puntos pendientes de confirmación").waitFor();

  let finalBalance = initialBalance;
  for (let attempt = 0; attempt < 20; attempt++) {
    await club.waitForTimeout(1500);
    finalBalance = (await (await club.request.get(accountUrl)).json()).confirmedBalance;
    if (finalBalance === initialBalance + 115) break;
  }
  assert.equal(finalBalance, initialBalance + 115);
  await club.reload();
  await club.waitForFunction((expected) => {
    const balance = document.querySelector(".club-points-card strong");
    return balance?.textContent?.trim() === String(expected);
  }, finalBalance);
  await club.getByRole("link", { name: "Ver compras" }).click();
  await club.getByText("+115 puntos").first().waitFor();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ memberNumber, initialBalance, salePoints: 115, finalBalance, rule: 100 }));
} finally {
  await context.close();
  await browser.close();
}
