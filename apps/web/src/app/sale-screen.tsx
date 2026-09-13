import { useEffect, useMemo, useState } from "react";
import type { PaymentMethod, SaleProduct } from "@ramax/contracts";
import { Link } from "react-router-dom";
import { closeSale, getSaleProducts } from "./session.ts";

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Efectivo" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "other", label: "Otro" },
];

type CartItem = { product: SaleProduct; quantity: number };

function formatArs(amount: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
}

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `sale-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function SaleScreen() {
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<{ saleId: string; totalArs: number }>();

  useEffect(() => {
    void getSaleProducts()
      .then((items) => setProducts(items.filter((item) => item.status === "active")))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No pudimos cargar el catálogo."))
      .finally(() => setLoading(false));
  }, []);

  const cart = useMemo<CartItem[]>(() => products.flatMap((product) => {
    const quantity = quantities[product.id] ?? 0;
    return quantity > 0 ? [{ product, quantity }] : [];
  }), [products, quantities]);
  const totalArs = cart.reduce((total, item) => total + item.product.priceArs * item.quantity, 0);

  function changeQuantity(product: SaleProduct, delta: number) {
    setError(undefined);
    setQuantities((current) => {
      let nextQuantity = Math.max(0, (current[product.id] ?? 0) + delta);
      if (product.tracksStock) nextQuantity = Math.min(nextQuantity, product.quantity);
      if (nextQuantity === 0) {
        const { [product.id]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [product.id]: nextQuantity };
    });
  }

  async function submitSale() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const closed = await closeSale({
        items: cart.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        paymentMethod,
      }, newIdempotencyKey());
      setSuccess(closed);
      setQuantities({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos cerrar la venta.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className="sale-result" aria-labelledby="sale-result-title">
        <p className="eyebrow">VENTA REGISTRADA</p>
        <h1 id="sale-result-title">Listo.</h1>
        <p>Se registró el cobro por {formatArs(success.totalArs)}.</p>
        <p className="sale-result__code">Comprobante {success.saleId.slice(0, 8).toUpperCase()}</p>
        <div className="sale-result__actions">
          <button className="button button--primary" type="button" onClick={() => setSuccess(undefined)}>Nueva venta <span aria-hidden="true">+</span></button>
          <Link className="back-link" to="/operacion">Volver a caja</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="sale-screen" aria-labelledby="sale-title">
      <Link className="back-link" to="/operacion">← Volver a caja</Link>
      <p className="eyebrow">NUEVA VENTA</p>
      <h1 id="sale-title">Tomar pedido</h1>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="sale-layout">
        <section className="sale-catalog" aria-label="Catálogo de productos">
          <h2>Productos</h2>
          {loading ? <p className="helper-text">Cargando catálogo...</p> : null}
          {!loading && products.length === 0 ? <p className="helper-text">No hay productos activos para vender.</p> : null}
          <div className="product-grid">
            {products.map((product) => {
              const unavailable = product.tracksStock && product.quantity < 1;
              return (
                <article className="product-card" key={product.id}>
                  <p className="product-card__category">{product.category ?? "SIN CATEGORÍA"}</p>
                  <h3>{product.name}</h3>
                  <p className="product-card__price">{formatArs(product.priceArs)}</p>
                  {product.tracksStock ? <p className={unavailable ? "stock-note stock-note--empty" : "stock-note"}>Stock: {product.quantity}</p> : <p className="stock-note">Sin control de stock</p>}
                  <button className="button product-card__add" type="button" disabled={unavailable} onClick={() => changeQuantity(product, 1)}>
                    {unavailable ? "Sin stock" : "Agregar"} <span aria-hidden="true">+</span>
                  </button>
                </article>
              );
            })}
          </div>
        </section>
        <aside className="sale-cart" aria-label="Pedido actual">
          <p className="eyebrow">PEDIDO</p>
          <h2>{cart.length === 0 ? "Todavía vacío" : `${cart.length} producto${cart.length === 1 ? "" : "s"}`}</h2>
          <div className="cart-lines">
            {cart.map(({ product, quantity }) => (
              <div className="cart-line" key={product.id}>
                <div><h3>{product.name}</h3><p>{formatArs(product.priceArs)} c/u</p></div>
                <div className="quantity-control" aria-label={`Cantidad de ${product.name}`}>
                  <button type="button" onClick={() => changeQuantity(product, -1)} aria-label={`Quitar un ${product.name}`}>−</button>
                  <span>{quantity}</span>
                  <button type="button" disabled={product.tracksStock && quantity >= product.quantity} onClick={() => changeQuantity(product, 1)} aria-label={`Agregar un ${product.name}`}>+</button>
                </div>
              </div>
            ))}
          </div>
          <label className="payment-select">Medio de pago
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </select>
          </label>
          <div className="cart-total"><span>Total</span><strong>{formatArs(totalArs)}</strong></div>
          <button className="button button--primary button--block" type="button" disabled={cart.length === 0 || submitting} onClick={() => void submitSale()}>
            {submitting ? "Registrando..." : "Cerrar venta"} <span aria-hidden="true">→</span>
          </button>
        </aside>
      </div>
    </section>
  );
}
