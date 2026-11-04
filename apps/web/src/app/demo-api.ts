// Browser-only sample records for the isolated /maquetas/admin routes.
import type { SaleProduct } from "@ramax/contracts";

const sampleProducts: SaleProduct[] = [
  { id: "cappuccino", name: "Cappuccino", sku: null, category: "Bebidas calientes", priceArs: 4500, tracksStock: true, status: "active", quantity: 24, minimumQuantity: 0 },
  { id: "medialuna", name: "Medialuna clásica", sku: null, category: "Panadería", priceArs: 2500, tracksStock: true, status: "active", quantity: 12, minimumQuantity: 0 },
  { id: "americano", name: "Café americano", sku: null, category: "Bebidas calientes", priceArs: 3000, tracksStock: true, status: "active", quantity: 18, minimumQuantity: 0 },
];
const sampleStaff = [
  { id: "ana", displayName: "Ana", username: "ana", role: "admin", active: true },
  { id: "lucia", displayName: "Lucía", username: "lucia", role: "employee", active: true },
  { id: "marcos", displayName: "Marcos", username: "marcos", role: "employee", active: false },
];
const sampleMovements = [
  { id: "m1", productId: "medialuna", productName: "Medialuna clásica", delta: 24, balanceAfter: 24, reason: "Recepción de mercadería", createdAt: "2026-10-03T13:00:00Z", responsible: "Ana" },
  { id: "m2", productId: "medialuna", productName: "Medialuna clásica", delta: -2, balanceAfter: 22, reason: "Merma por rotura", createdAt: "2026-10-02T13:00:00Z", responsible: "Ana" },
];
const sampleBackups = [
  { id: "b1", createdAt: "2026-10-04T06:00:00Z", status: "valid", schemaVersion: "0002" },
  { id: "b2", createdAt: "2026-10-03T06:00:00Z", status: "valid", schemaVersion: "0002" },
  { id: "b3", createdAt: "2026-10-02T06:00:00Z", status: "valid", schemaVersion: "0002" },
];
const sampleSale = {
  id: "248", saleNumber: 248, status: "closed", totalArs: 11500,
  createdAt: "2026-10-04T16:32:00.000Z", paymentMethod: "cash", responsible: "Lucía",
  voidedAt: null as string | null, voidedBy: null as string | null, voidReason: null as string | null,
  items: [
    { productName: "Cappuccino", quantity: 2, unitPriceArs: 4500, subtotalArs: 9000 },
    { productName: "Medialuna clásica", quantity: 1, unitPriceArs: 2500, subtotalArs: 2500 },
  ],
};
let nextProductId = 4;
let nextStaffId = 4;
let nextMovementId = 3;
let nextSaleNumber = 249;
const sampleJobs: { id: string; createdAt: string; status: "succeeded"; error: null }[] = [];

export const demoSession = {
  authenticated: true as const,
  user: { id: "ana", displayName: "Ana", primaryRole: "admin" as const, roles: ["admin" as const], permissions: [] },
  homePath: "/maquetas/admin/equipo",
};

export async function demoApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, "https://maqueta.ramax.local");
  const route = url.pathname;
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
  let result: unknown;

  if (route === "/auth/me" || route === "/auth/login") result = demoSession;
  else if (route === "/auth/logout") result = {};
  else if (route === "/health") result = { internet: true };
  else if (route === "/staff" && method === "GET") result = [...sampleStaff];
  else if (route === "/staff" && method === "POST") {
    const user = { id: "demo-" + nextStaffId++, displayName: String(body.displayName), username: String(body.username), role: String(body.role), active: true };
    sampleStaff.push(user);
    result = user;
  }
  else if (route.startsWith("/staff/") && route.endsWith("/deactivate")) {
    const user = sampleStaff.find((item) => item.id === route.split("/")[2]);
    if (user) user.active = false;
    result = {};
  }
  else if (route.startsWith("/staff/") && route.endsWith("/password")) result = {};
  else if (route === "/products" && method === "GET") result = [...sampleProducts];
  else if (route === "/products" && method === "POST") {
    const product: SaleProduct = { id: "demo-" + nextProductId++, name: String(body.name), sku: String(body.sku || "") || null, category: String(body.category || ""), priceArs: Number(body.priceArs), tracksStock: Boolean(body.tracksStock), status: "active", quantity: 0, minimumQuantity: Number(body.minimumQuantity || 0) };
    sampleProducts.push(product);
    result = product;
  }
  else if (route.startsWith("/products/") && method === "PATCH") {
    const product = sampleProducts.find((item) => item.id === route.split("/")[2]);
    if (product) Object.assign(product, { name: body.name, sku: body.sku || null, category: body.category, priceArs: body.priceArs, status: body.active ? "active" : "inactive" });
    result = product;
  }
  else if (route === "/inventory/movements") result = sampleMovements.filter((item) => !url.searchParams.get("productId") || item.productId === url.searchParams.get("productId"));
  else if (route === "/inventory/adjustments") {
    const product = sampleProducts.find((item) => item.id === body.productId);
    if (product) {
      product.quantity += Number(body.delta);
      sampleMovements.unshift({ id: "m" + nextMovementId++, productId: product.id, productName: product.name, delta: Number(body.delta), balanceAfter: product.quantity, reason: String(body.reason), createdAt: new Date().toISOString(), responsible: "Ana" });
    }
    result = {};
  }
  else if (route === "/backups") result = { backups: sampleBackups, jobs: sampleJobs, maintenance: false };
  else if (route === "/backups/restore") {
    const job = { id: "job-" + (sampleJobs.length + 1), createdAt: new Date().toISOString(), status: "succeeded" as const, error: null };
    sampleJobs.unshift(job);
    result = job;
  }
  else if (route === "/sales" && method === "GET") {
    const number = url.searchParams.get("number");
    const status = url.searchParams.get("status");
    const items = [sampleSale].filter((sale) => (!number || String(sale.saleNumber) === number) && (!status || sale.status === status));
    result = { items, page: Number(url.searchParams.get("page") || 1), pageSize: 20, total: items.length };
  }
  else if (route === "/sales" && method === "POST") {
    const items = Array.isArray(body.items) ? body.items as { productId: string; quantity: number }[] : [];
    sampleSale.items = items.map((item) => {
      const product = sampleProducts.find((candidate) => candidate.id === item.productId)!;
      return { productName: product.name, quantity: item.quantity, unitPriceArs: product.priceArs, subtotalArs: product.priceArs * item.quantity };
    });
    sampleSale.saleNumber = nextSaleNumber++;
    sampleSale.totalArs = Number(body.expectedTotalArs);
    sampleSale.paymentMethod = String(body.paymentMethod);
    sampleSale.status = "closed";
    result = { saleId: sampleSale.id, saleNumber: sampleSale.saleNumber, totalArs: sampleSale.totalArs, status: sampleSale.status };
  }
  else if (route === "/sales/248" && method === "GET") result = { ...sampleSale };
  else if (route === "/sales/248/void") {
    sampleSale.status = "void";
    sampleSale.voidReason = String(body.reason);
    sampleSale.voidedBy = "Ana";
    sampleSale.voidedAt = new Date().toISOString();
    result = {};
  }
  else throw new Error("No hay datos de ejemplo para " + route);

  return result as T;
}
