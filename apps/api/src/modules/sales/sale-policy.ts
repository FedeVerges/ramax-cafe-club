export type SaleRequestItem = { productId: string; quantity: number };

export type SaleProduct = {
  id: string;
  name: string;
  priceArs: number;
  tracksStock: boolean;
  status: "active" | "inactive";
};

export type SaleSnapshot = {
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceArs: number;
    subtotalArs: number;
    tracksStock: boolean;
  }>;
  totalArs: number;
  stockQuantities: Map<string, number>;
};

export class SaleRuleError extends Error {}

export function buildSaleSnapshot(requestItems: SaleRequestItem[], products: SaleProduct[]): SaleSnapshot {
  const productById = new Map(products.map((product) => [product.id, product]));
  const items = requestItems.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new SaleRuleError("Uno de los productos ya no existe.");
    if (product.status !== "active") throw new SaleRuleError(`${product.name} está inactivo.`);
    return {
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPriceArs: product.priceArs,
      subtotalArs: product.priceArs * item.quantity,
      tracksStock: product.tracksStock,
    };
  });
  const totalArs = items.reduce((total, item) => total + item.subtotalArs, 0);
  if (!Number.isSafeInteger(totalArs) || totalArs <= 0) throw new SaleRuleError("El total de la venta no es válido.");

  const stockQuantities = new Map<string, number>();
  for (const item of items) {
    if (item.tracksStock) stockQuantities.set(item.productId, (stockQuantities.get(item.productId) ?? 0) + item.quantity);
  }
  return { items, totalArs, stockQuantities };
}
