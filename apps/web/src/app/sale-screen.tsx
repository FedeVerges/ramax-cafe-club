import { useRef, useState } from "react";
import type {
  CloseSaleInput,
  ClosedSale,
  PaymentMethod,
  SaleProduct,
} from "@ramax/contracts";
import { Link } from "react-router-dom";
import { ApiError, closeSale } from "./session";
import { money, Notice, useData } from "./ui";
import { BrandButton } from "./brand-ui";
export function SaleScreen() {
  const products = useData<SaleProduct[]>("/products");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<"products" | "review" | "payment">(
    "products",
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ClosedSale>();
  const pending = useRef(false);
  const attempt = useRef<{ key: string; input: CloseSaleInput } | undefined>(
    undefined,
  );
  const cart = (products.data ?? [])
    .filter((p) => quantities[p.id])
    .map((p) => ({ product: p, quantity: quantities[p.id]! }));
  const total = cart.reduce(
    (sum, i) => sum + i.product.priceArs * i.quantity,
    0,
  );
  function change(p: SaleProduct, delta: number) {
    setQuantities((q) => ({
      ...q,
      [p.id]: Math.max(
        0,
        Math.min(
          (q[p.id] ?? 0) + delta,
          p.tracksStock ? p.quantity : Number.MAX_SAFE_INTEGER,
        ),
      ),
    }));
  }
  async function submit() {
    if (pending.current || !cart.length) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    attempt.current ??= {
      key: crypto.randomUUID(),
      input: {
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        paymentMethod: method,
        expectedTotalArs: total,
        transferConfirmed: confirmed,
      },
    };
    try {
      setResult(await closeSale(attempt.current.input, attempt.current.key));
      setQuantities({});
      setUncertain(false);
      attempt.current = undefined;
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        attempt.current = undefined;
        setUncertain(false);
        if (["PRICE_CHANGED", "INSUFFICIENT_STOCK"].includes(e.code ?? "")) {
          products.reload();
          setStage("review");
        }
      } else setUncertain(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function reset() {
    setResult(undefined);
    setQuantities({});
    setStage("products");
    setConfirmed(false);
    setMethod("cash");
    setError(undefined);
    attempt.current = undefined;
    products.reload();
  }
  if (result)
    return (
      <section className="panel sale-result">
        <p className="eyebrow">VENTA REGISTRADA</p>
        <h1>Venta N.º {result.saleNumber}</h1>
        <p>Se registró el cobro por {money(result.totalArs)}.</p>
        <Link
          className="button button--primary"
          to={`/ventas/${result.saleId}`}
        >
          Ver e imprimir comprobante
        </Link>
        <button onClick={reset}>Nueva venta</button>
      </section>
    );
  return (
    <section>
      <h1>
        {stage === "products"
          ? "Nueva venta"
          : stage === "review"
            ? "Revisar venta"
            : "Cobrar venta"}
      </h1>
      <Notice error={error ?? products.error} />
      {uncertain && (
        <p role="alert">
          La respuesta no llegó. Reintentá el mismo cobro o consultá Ventas
          antes de iniciar otro.
        </p>
      )}
      <fieldset disabled={busy || uncertain}>
        <div className="sale-layout">
          {stage === "products" && (
            <div>
              <div className="filters">
                <label>
                  Buscar producto
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  Categoría
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Todas</option>
                    {[
                      ...new Set(
                        products.data?.map((p) => p.category).filter(Boolean),
                      ),
                    ].map((c) => (
                      <option key={c} value={c!}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {products.loading && <p>Cargando catálogo…</p>}
              <div className="product-grid">
                {products.data
                  ?.filter(
                    (p) =>
                      p.status === "active" &&
                      p.name.toLowerCase().includes(search.toLowerCase()) &&
                      (!category || p.category === category),
                  )
                  .map((p) => (
                    <article className="product-card" key={p.id}>
                      <small>{p.category ?? "Sin categoría"}</small>
                      <h2>{p.name}</h2>
                      <strong>{money(p.priceArs)}</strong>
                      <p>
                        {p.tracksStock
                          ? `Stock: ${p.quantity}`
                          : "Sin control de stock"}
                      </p>
                      <button
                        disabled={
                          p.tracksStock && (quantities[p.id] ?? 0) >= p.quantity
                        }
                        onClick={() => change(p, 1)}
                      >
                        Agregar
                      </button>
                    </article>
                  ))}
              </div>
              {products.data?.length === 0 && (
                <p>
                  No hay productos. El administrador debe preparar el catálogo.
                </p>
              )}
            </div>
          )}
          <div className="panel">
            <h2>Pedido</h2>
            {cart.length === 0 && <p>Agregá productos para empezar.</p>}
            {cart.map(({ product: p, quantity }) => (
              <div className="cart-line" key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {money(p.priceArs)} c/u · {money(p.priceArs * quantity)}
                  </small>
                </div>
                <div className="quantity-control">
                  <button
                    disabled={stage === "payment"}
                    aria-label={`Quitar ${p.name}`}
                    onClick={() => change(p, -1)}
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button
                    disabled={
                      stage === "payment" ||
                      (p.tracksStock && quantity >= p.quantity)
                    }
                    aria-label={`Agregar ${p.name}`}
                    onClick={() => change(p, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <div className="cart-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            {stage === "payment" && (
              <>
                <label>
                  Medio de pago
                  <select
                    value={method}
                    onChange={(e) => {
                      setMethod(e.target.value as PaymentMethod);
                      setConfirmed(false);
                    }}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                  </select>
                </label>
                {method === "transfer" && (
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    Confirmo que recibí la transferencia
                  </label>
                )}
              </>
            )}
            {stage !== "payment" && (
              <BrandButton
                disabled={!cart.length}
                onClick={() =>
                  setStage(stage === "products" ? "review" : "payment")
                }
              >
                {stage === "products" ? "Revisar venta" : "Continuar al cobro"}
              </BrandButton>
            )}
            {stage !== "products" && (
              <button onClick={() => setStage("products")}>
                Agregar o quitar productos
              </button>
            )}
            <button onClick={reset}>Cancelar venta</button>
          </div>
        </div>
      </fieldset>
      {stage === "payment" && (
        <BrandButton
          disabled={
            busy || !cart.length || (method === "transfer" && !confirmed)
          }
          onClick={() => void submit()}
        >
          {busy
            ? "Registrando…"
            : uncertain
              ? "Reintentar el mismo cobro"
              : "Confirmar cobro"}
        </BrandButton>
      )}
    </section>
  );
}
