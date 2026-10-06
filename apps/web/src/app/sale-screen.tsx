import { salesDate as date, salesMoney as money } from "./sales-format";
import { useRef, useState } from "react";
import type {
  CloseSaleInput,
  ClosedSale,
  PaymentMethod,
  SaleProduct,
  SaleDetail,
} from "@ramax/contracts";
import { Link } from "react-router-dom";
import { ApiError, closeSale } from "./session";
import { Notice, useData } from "./ui";
import { BrandButton, RamaxIcon } from "./brand-ui";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { MoneyIcon } from "@phosphor-icons/react/dist/csr/Money";
import { BankIcon } from "@phosphor-icons/react/dist/csr/Bank";


function Quantity({ product, quantity, change }: { product: SaleProduct; quantity: number; change: (product: SaleProduct, delta: number) => void }) {
  return <div className="sales-quantity">
    {quantity > 0 && <><button type="button" aria-label={`Quitar ${product.name}`} onClick={() => change(product, -1)}><MinusIcon size={22} /></button><output aria-label={`Cantidad de ${product.name}`}>{quantity}</output></>}
    <button type="button" className="sales-quantity__add" aria-label={`Agregar ${product.name}`} disabled={product.tracksStock && quantity >= product.quantity} onClick={() => change(product, 1)}><PlusIcon size={24} /></button>
  </div>;
}

function RegisteredSale({ result, reset }: { result: ClosedSale; reset: () => void }) {
  const detail = useData<SaleDetail>(`/sales/${result.saleId}`);
  return <section className="sales-ui sales-success">
    <span className="sales-success__icon"><RamaxIcon name="confirmed" size={42} /></span>
    <h1>Venta registrada</h1><h2>Venta N.º {result.saleNumber}</h2>
    {detail.data && <p className="sales-muted">{date(detail.data.createdAt)} · San Luis</p>}
    <Notice error={detail.error} />
    {detail.loading && <p>Cargando comprobante…</p>}
    {detail.error && <button onClick={detail.reload}>Reintentar comprobante</button>}
    <div className="sales-receipt-lines">{detail.data?.items.map((item, i) => <div className="sales-summary-line" key={i}><span>{item.quantity} × {item.productName}</span><strong>{money(item.subtotalArs)}</strong></div>)}</div>
    <div className="sales-total"><span>Total cobrado</span><strong>{money(result.totalArs)}</strong></div>
    {detail.data && <p>{detail.data.paymentMethod === "cash" ? "Efectivo" : "Transferencia"} · Atendió {detail.data.responsible}</p>}
    <BrandButton onClick={reset}>Nueva venta <RamaxIcon name="next" /></BrandButton>
    <Link className="button button--secondary" to={`/ventas/${result.saleId}`}><RamaxIcon name="print" />Ver e imprimir comprobante</Link>
  </section>;
}

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
  const visibleProducts = (products.data ?? []).filter((p) => p.status === "active" && p.name.toLowerCase().includes(search.toLowerCase()) && (!category || p.category === category));
  const categories = [...new Set((products.data ?? []).filter((p) => p.status === "active").map((p) => p.category).filter((c): c is string => Boolean(c)))];
  const units = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (result) return <RegisteredSale result={result} reset={reset} />;
  return (
    <section className={`sales-ui sales-compose sales-compose--${stage}`}>
      {stage === "payment" && <button className="sales-back" disabled={busy || uncertain} onClick={() => setStage(stage === "payment" ? "review" : "products")}><RamaxIcon name="back" />Volver a {stage === "payment" ? "revisar venta" : "productos"}</button>}
      <h1>{stage === "products" ? "Nueva venta" : stage === "review" ? "Revisar venta" : "Cobrar venta"}</h1>
      <Notice error={error ?? products.error} />
      {uncertain && <p className="sales-info" role="alert">La respuesta no llegó. Reintentá el mismo cobro o consultá Ventas antes de iniciar otro.</p>}
      <fieldset disabled={busy || uncertain}>
        {stage === "products" ? <>
          <div className="sales-search"><RamaxIcon name="search" size={25} /><input aria-label="Buscar producto" placeholder="Buscar producto" value={search} onChange={(e) => setSearch(e.target.value)} />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch("")}><XIcon size={20} /></button>}</div>
          <div className="sales-categories" role="group" aria-label="Categoría">
            {["", ...categories].map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>{c || "Todos"}</button>)}
          </div>
          {products.loading && <p role="status">Cargando catálogo…</p>}
          <div className="sales-products">{visibleProducts.map((p) => <article className="sales-product" key={p.id}>
            <div><h2>{p.name}</h2><p>{money(p.priceArs)}</p>{p.tracksStock && p.quantity === 0 && <small>Sin stock</small>}</div>
            <Quantity product={p} quantity={quantities[p.id] ?? 0} change={change} />
          </article>)}</div>
          {!products.loading && !products.error && visibleProducts.length === 0 && <p>No hay productos para esta búsqueda.</p>}
          <div className="sales-order-dock"><div><span>{units} {units === 1 ? "unidad" : "unidades"}</span><strong>Total {money(total)}</strong></div><BrandButton disabled={!cart.length} onClick={() => setStage("review")}>Ver pedido <RamaxIcon name="next" /></BrandButton></div>
        </> : <div className="sales-order">
          {cart.length === 0 && <p>Agregá productos para empezar.</p>}
          {stage === "payment" && <h2 className="sales-section-title">Resumen de productos</h2>}
          <div className="sales-order-lines">{cart.map(({product: p, quantity}) => <article className="sales-review-line" key={p.id}>
            <div><h2>{stage === "payment" ? `${quantity} × ` : ""}{p.name}</h2>{stage === "review" && <small>{money(p.priceArs)} c/u</small>}</div>
            {stage === "review" && <Quantity product={p} quantity={quantity} change={change} />}
            <strong className="sales-line-total">{money(p.priceArs * quantity)}</strong>
          </article>)}</div>
          {stage === "review" && <button className="sales-add-products" onClick={() => setStage("products")}><PlusIcon size={22} />Agregar productos</button>}
          <div className="sales-total"><span>Total</span><strong>{money(total)}</strong></div>
          {stage === "payment" && <>
            <h2 className="sales-section-title">Medio de pago</h2>
            <div className="sales-payment" role="group" aria-label="Medio de pago">{(["cash", "transfer"] as const).map((value) => <label className={`sales-payment-option${method === value ? " is-selected" : ""}`} key={value}>
              <input type="radio" name="payment" value={value} checked={method === value} onChange={() => {setMethod(value); setConfirmed(false);}} />
              {value === "cash" ? <MoneyIcon size={32} /> : <BankIcon size={32} />}<span>{value === "cash" ? "Efectivo" : "Transferencia"}</span>
              {method === value && <RamaxIcon name="confirmed" className="sales-payment-check" />}
            </label>)}</div>
            {method === "transfer" && <label className="checkbox-field sales-transfer"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Confirmo que recibí la transferencia</label>}
            <p className="sales-info">Al confirmar se registra el cobro y se descuenta el stock de los productos controlados.</p>
          </>}
          {stage === "review" && <BrandButton disabled={!cart.length} onClick={() => setStage("payment")}>Continuar al cobro <RamaxIcon name="next" /></BrandButton>}
          {stage === "review" && <button className="sales-cancel" onClick={reset}>Cancelar venta</button>}
        </div>}
      </fieldset>
      {stage === "payment" && <div className="sales-submit"><BrandButton disabled={busy || !cart.length || (method === "transfer" && !confirmed)} onClick={() => void submit()}>{busy ? "Registrando…" : uncertain ? "Reintentar el mismo cobro" : `Confirmar cobro · ${money(total)}`}</BrandButton><p>La venta se registra una sola vez.</p><button className="sales-cancel" disabled={busy || uncertain} onClick={reset}>Cancelar venta</button></div>}
    </section>
  );
}
