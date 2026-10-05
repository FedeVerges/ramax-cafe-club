import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const directory = resolve(root, "var/demo");
const manifestPath = resolve(directory, "seed.json");
const lockPath = resolve(directory, "seed.lock");

// Precios ficticios en pesos enteros. Los datos se cargan mediante la API,
// con sus reglas de permisos, auditoría, stock e idempotencia.
const catalog = [
  ["ESP", "Espresso", "Cafetería", 2100, false, 0, 0],
  ["AME", "Americano", "Cafetería", 2500, false, 0, 0],
  ["LAT", "Latte", "Cafetería", 3200, false, 0, 0],
  ["CAP", "Capuchino", "Cafetería", 3500, false, 0, 0],
  ["TE", "Té en hebras", "Cafetería", 2300, false, 0, 0],
  ["CHO", "Chocolate caliente", "Cafetería", 3400, false, 0, 0],
  ["MED", "Medialuna de manteca", "Panadería", 1400, true, 80, 10],
  ["MUF", "Muffin de arándanos", "Panadería", 2800, true, 40, 5],
  ["COO", "Cookie con chocolate", "Panadería", 2200, true, 60, 8],
  ["TOS", "Tostado de jamón y queso", "Salados", 5200, true, 30, 5],
  ["JAM", "Sándwich de jamón y queso", "Salados", 5800, true, 30, 5],
  ["VEG", "Sándwich vegetariano", "Salados", 5600, true, 4, 5],
  ["BRO", "Brownie", "Postres", 3200, true, 0, 5],
  ["CHE", "Porción de cheesecake", "Postres", 4500, true, 20, 4],
  ["AGU", "Agua mineral 500 ml", "Bebidas", 1800, true, 60, 10],
  ["GAS", "Gaseosa 500 ml", "Bebidas", 2300, true, 45, 8],
  ["JUG", "Jugo de naranja", "Bebidas", 3000, true, 12, 10],
  ["TAR", "Tarta de manzana de temporada", "Postres", 3900, true, 6, 3],
];
const baskets = [
  [["ESP", 1], ["MED", 2]],
  [["LAT", 2], ["COO", 2]],
  [["AME", 1], ["TOS", 1]],
  [["CAP", 1], ["MUF", 1]],
  [["JAM", 1], ["AGU", 1]],
  [["TE", 1], ["CHE", 1]],
  [["CHO", 1], ["MED", 2]],
  [["AGU", 2], ["GAS", 1], ["JUG", 1]],
];
const voidIndexes = [2, 9, 16, 23];

async function main() {
  if (!process.argv.includes("--confirm")) {
    throw new Error("Usá --confirm para agregar los datos demo a la réplica local.");
  }
  let savedAccess;
  try {
    savedAccess = JSON.parse(await readFile(resolve(root, "var/local-adaptation/access.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const access = {
    url: process.env.SEED_BASE_URL ?? savedAccess?.url ?? "http://localhost:3000",
    username: process.env.SEED_USERNAME ?? savedAccess?.username ?? process.env.ADMIN_USERNAME,
    password: process.env.SEED_PASSWORD ?? savedAccess?.password ?? process.env.ADMIN_PASSWORD,
  };
  if (!access.username || !access.password) throw new Error("Configurá SEED_USERNAME/SEED_PASSWORD o ADMIN_USERNAME/ADMIN_PASSWORD para el administrador existente.");
  const url = new URL(access.url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Este seed solo permite la réplica local.");
  }
  await mkdir(directory, { recursive: true });
  await writeFile(lockPath, String(process.pid), { flag: "wx", mode: 0o600 });
  const cookies = [];
  try {
    let state;
    try {
      state = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      state = {
        version: 1,
        url: access.url,
        createdAt: new Date().toISOString(),
        staff: [
          { username: "demo_manana", displayName: "Demo · Turno mañana", role: "employee", password: randomBytes(15).toString("base64url") },
          { username: "demo_tarde", displayName: "Demo · Turno tarde", role: "employee", password: randomBytes(15).toString("base64url") },
          { username: "demo_inactivo", displayName: "Demo · Cuenta desactivada", role: "employee", password: randomBytes(15).toString("base64url") },
        ],
        steps: {},
      };
    }
    if (state.version !== 1 || state.url !== access.url) throw new Error("El registro demo pertenece a otra instalación.");
    const save = async () => {
      const temp = `${manifestPath}.tmp`;
      await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
      await rename(temp, manifestPath);
    };
    await save();
    await writeFile(resolve(directory, "access.json"), JSON.stringify({
      url: access.url,
      accounts: state.staff.map(({ username, displayName, password }) => ({ username, displayName, password })),
    }, null, 2), { mode: 0o600 });
    async function request(path, { cookie, method = "GET", body, key } = {}) {
      const response = await fetch(new URL(`/api/v1${path}`, access.url), {
        method,
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
          ...(key ? { "idempotency-key": `ramax-demo-v1:${key}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(`${method} ${path}: ${response.status} ${String(data.message ?? "Operación rechazada")}`);
      }
      return response;
    }
    async function login(username, password) {
      const response = await request("/auth/login", { method: "POST", body: { username, password } });
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error("El acceso no devolvió una sesión.");
      cookies.push(cookie);
      return { cookie, session: await response.json() };
    }
    const admin = await login(access.username, access.password);
    if (admin.session.user.primaryRole !== "admin") throw new Error("El seed necesita un administrador.");
    if (state.actorId && state.actorId !== admin.session.user.id) throw new Error("El administrador cambió. Revisá el registro demo antes de reintentar.");
    state.actorId = admin.session.user.id;
    await save();
    async function step(key, path, body, cookie = admin.cookie, method = "POST") {
      if (Object.hasOwn(state.steps, key)) return state.steps[key];
      const result = await (await request(path, { method, body, cookie, key })).json();
      state.steps[key] = result;
      await save();
      return result;
    }
    const staff = [];
    for (const input of state.staff) {
      staff.push(await step(`staff:${input.username}`, "/staff", input));
    }
    await step("staff:inactive", `/staff/${staff[2].id}/deactivate`, {});
    const employees = [];
    for (const input of state.staff.slice(0, 2)) employees.push(await login(input.username, input.password));
    const products = new Map();
    for (const [code, name, category, priceArs, tracksStock, quantity, minimumQuantity] of catalog) {
      const product = await step(`product:${code}`, "/products", {
        sku: `DEMO-${code}`, name, category, priceArs, tracksStock, minimumQuantity,
        description: "Producto de prueba cargado por seed demo v1.",
      });
      products.set(code, product);
      if (quantity > 0) await step(`stock:${code}`, "/inventory/adjustments", {
        productId: product.id, delta: quantity, reason: "Demo · Ingreso inicial de existencias",
      });
    }
    await step("product:TAR:inactive", `/products/${products.get("TAR").id}`, { active: false }, admin.cookie, "PATCH");
    const sales = [];
    for (let i = 0; i < 24; i++) {
      const basket = baskets[i % baskets.length];
      const paymentMethod = i % 3 === 1 ? "transfer" : "cash";
      const body = {
        items: basket.map(([code, quantity]) => ({ productId: products.get(code).id, quantity })),
        expectedTotalArs: basket.reduce((total, [code, quantity]) => total + products.get(code).priceArs * quantity, 0),
        paymentMethod,
        ...(paymentMethod === "transfer" ? { transferConfirmed: true } : {}),
      };
      sales.push(await step(`sale:${i + 1}`, "/sales", body, employees[i % employees.length].cookie));
    }
    for (const i of voidIndexes) await step(`void:${i + 1}`, `/sales/${sales[i].saleId}/void`, {
      reason: "Demo · Anulación de prueba con devolución simulada", refundConfirmed: true,
    });
    await step("stock:COO:damage", "/inventory/adjustments", {
      productId: products.get("COO").id, delta: -2, reason: "Demo · Merma de dos cookies",
    });
    await step("product:ESP:price", `/products/${products.get("ESP").id}`, { priceArs: 2300 }, admin.cookie, "PATCH");
    state.completedAt ??= new Date().toISOString();
    await save();
    console.log("Demo lista: 18 productos, 3 cuentas, 24 ventas; 4 anuladas.");
    console.log("Accesos: var/demo/access.json. Registro: var/demo/seed.json. Repetir no duplica las operaciones registradas.");
  } finally {
    for (const cookie of cookies) {
      await fetch(new URL("/api/v1/auth/logout", access.url), { method: "POST", headers: { cookie }, signal: AbortSignal.timeout(3000) }).catch(() => undefined);
    }
    await unlink(lockPath);
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
