import { describe, expect, it } from "vitest";
import { buildSaleSnapshot, SaleRuleError } from "./sale-policy";

const products = [
  { id: "espresso", name: "Espresso", priceArs: 4500, tracksStock: true, status: "active" as const },
  { id: "servicio", name: "Servicio", priceArs: 900, tracksStock: false, status: "active" as const },
  { id: "pausado", name: "Producto pausado", priceArs: 1000, tracksStock: true, status: "inactive" as const },
];

describe("buildSaleSnapshot", () => {
  it("guarda el precio actual en cada ítem y agrupa el stock por producto", () => {
    const sale = buildSaleSnapshot(
      [
        { productId: "espresso", quantity: 2 },
        { productId: "espresso", quantity: 1 },
        { productId: "servicio", quantity: 1 },
      ],
      products,
    );

    expect(sale.totalArs).toBe(14400);
    expect(sale.items[0]).toMatchObject({ unitPriceArs: 4500, subtotalArs: 9000 });
    expect(sale.stockQuantities.get("espresso")).toBe(3);
    expect(sale.stockQuantities.has("servicio")).toBe(false);
  });

  it("rechaza productos inactivos", () => {
    expect(() => buildSaleSnapshot([{ productId: "pausado", quantity: 1 }], products)).toThrow(SaleRuleError);
  });

  it("rechaza productos que no existen", () => {
    expect(() => buildSaleSnapshot([{ productId: "inexistente", quantity: 1 }], products)).toThrow("ya no existe");
  });
});
