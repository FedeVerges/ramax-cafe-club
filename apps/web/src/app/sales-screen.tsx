import { salesDate as date, salesDay, salesTime, salesMoney as money } from "./sales-format";
import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { Page, SaleDetail, SaleSummary } from "@ramax/contracts";
import { Notice, useData, useMutation } from "./ui";
import { RamaxIcon, StatusPill } from "./brand-ui";
import { useStaff } from "./staff-context";
type SalesFilters = {
  number: string;
  from: string;
  to: string;
  status: string;
  paymentMethod: string;
};
const emptyFilters: SalesFilters = {
  number: "", from: "", to: "", status: "", paymentMethod: "",
};

export function SalesScreen() {
  const [draft, setDraft] = useState<SalesFilters>(emptyFilters);
  const [applied, setApplied] = useState<SalesFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const filterPanel = useRef<HTMLDetailsElement>(null);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(applied)) {
    if (value) params.set(key, key === "from" ? `${value}T00:00:00-03:00` : key === "to" ? `${value}T23:59:59.999-03:00` : value);
  }
  const list = useData<Page<SaleSummary>>(`/sales?page=${page}&${params}`);
  const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to);
  const hasFilters = Object.values(applied).some(Boolean);
  const extraFilters = [applied.from, applied.to, applied.status, applied.paymentMethod].filter(Boolean).length;
  const today = salesDay(new Date().toISOString());
  const yesterday = salesDay(new Date(Date.now() - 86400000).toISOString());
  const groups = Object.entries((list.data?.items ?? []).reduce<Record<string, SaleSummary[]>>((result, sale) => {
    const day = salesDay(sale.createdAt);
    (result[day] ??= []).push(sale);
    return result;
  }, {}));

  function update(key: keyof SalesFilters, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidRange) return;
    setPage(1);
    setApplied({ ...draft });
    if (filterPanel.current) filterPanel.current.open = false;
  }
  function clearFilters() {
    setDraft({ ...emptyFilters });
    setApplied({ ...emptyFilters });
    setPage(1);
    if (filterPanel.current) filterPanel.current.open = false;
  }
  const filterLabels = [
    applied.number && `N.º ${applied.number}`,
    applied.from && `Desde ${applied.from.split("-").reverse().join("/")}`,
    applied.to && `Hasta ${applied.to.split("-").reverse().join("/")}`,
    applied.status && (applied.status === "closed" ? "Finalizadas" : "Anuladas"),
    applied.paymentMethod && (applied.paymentMethod === "cash" ? "Efectivo" : "Transferencia"),
  ].filter(Boolean);

  return (
    <section className="sales-ui sales-history">
      <header className="sales-history-heading">
        <div><h1>Ventas</h1><p>Historial de ventas</p></div>
        {list.data && !list.loading && !list.error && <span className="sales-history-count">{list.data.total} {list.data.total === 1 ? "venta" : "ventas"}</span>}
      </header>
      <form className="sales-filters" onSubmit={filter}>
        <label className="sales-history-search">
          <span className="sales-visually-hidden">Número</span>
          <RamaxIcon name="search" size={22} />
          <input type="number" min={1} name="number" placeholder="N.º de venta" value={draft.number} onChange={(event) => update("number", event.target.value)} />
          <button type="submit" aria-label="Buscar venta" title="Buscar venta"><RamaxIcon name="next" size={20} /></button>
        </label>
        <details className="sales-filter-options" ref={filterPanel}>
          <summary><RamaxIcon name="calendar" size={22} /><span>Fechas y filtros</span>{extraFilters > 0 && <span className="sales-filter-count">{extraFilters}</span>}<RamaxIcon name="expand" size={16} /></summary>
          <div className="sales-filter-panel">
            <h2>Filtrar ventas</h2>
            <label>Desde<input type="date" name="from" value={draft.from} max={draft.to || undefined} onChange={(event) => update("from", event.target.value)} /></label>
            <label>Hasta<input type="date" name="to" value={draft.to} min={draft.from || undefined} onChange={(event) => update("to", event.target.value)} /></label>
            <label>Estado<select aria-label="Estado" name="status" value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="">Todos</option><option value="closed">Finalizada</option><option value="void">Anulada</option></select></label>
            <label>Pago<select aria-label="Pago" name="paymentMethod" value={draft.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)}><option value="">Todos</option><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select></label>
            {invalidRange && <p className="form-error" role="alert">La fecha inicial debe ser anterior o igual a la final.</p>}
            <button className="button button--primary" disabled={invalidRange}>Filtrar</button>
            <button className="sales-filter-reset" type="button" onClick={clearFilters}>Limpiar filtros</button>
          </div>
        </details>
      </form>
      {hasFilters && <div className="sales-applied-filters" aria-label="Filtros aplicados"><div>{filterLabels.map((label) => <span key={String(label)}>{label}</span>)}</div><button type="button" onClick={clearFilters}>Limpiar filtros</button></div>}
      <Notice error={list.error} />
      {list.error && <button className="sales-history-retry" onClick={list.reload}>Reintentar</button>}
      {list.loading ? <div className="sales-history-loading" role="status">Cargando ventas…</div> : !list.error && <div className="sales-history-list">
        {groups.map(([day, sales]) => <section className="sales-history-group" key={day}>
          <h2>{day === today ? `Hoy, ${day}` : day === yesterday ? `Ayer, ${day}` : day}</h2>
          <ul>{sales.map((sale) => <li key={sale.id}>
            <Link className={`sales-history-item${sale.status === "void" ? " sales-history-item--void" : ""}`} to={`/ventas/${sale.id}`}>
              <div className="sales-history-row-top"><span className="sales-history-number">N.º {sale.saleNumber}<span> · {salesTime(sale.createdAt)}</span></span><strong>{money(sale.totalArs)}</strong></div>
              <div className="sales-history-row-bottom">
                <div className="sales-history-meta"><span className="sales-history-payment">{sale.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}</span><span className="sales-history-staff"><RamaxIcon name="account" size={16} /><span title={sale.responsible}>{sale.responsible}</span></span></div>
                <div className="sales-history-trailing"><span className={`sales-history-state sales-history-state--${sale.status}`}>{sale.status === "closed" ? "Finalizada" : "Anulada"}</span><RamaxIcon name="chevron" size={24} /></div>
              </div>
            </Link>
          </li>)}</ul>
        </section>)}
        {list.data?.items.length === 0 && <div className="sales-history-empty"><RamaxIcon name="receipt" size={40} weight="light" /><h2>{hasFilters ? "Sin resultados" : "Todavía no hay ventas"}</h2><p>{hasFilters ? "Probá otro número o ampliá el rango de fechas." : "Las ventas registradas aparecerán acá."}</p>{hasFilters && <button onClick={clearFilters}>Limpiar filtros</button>}</div>}
      </div>}
      {list.data && !list.error && list.data.total > list.data.pageSize && <nav className="sales-pagination" aria-label="Paginación de ventas">
        <button disabled={page === 1 || list.loading} onClick={() => setPage((current) => current - 1)}><RamaxIcon name="back" size={18} /><span>Anterior</span></button>
        <span aria-live="polite">Página {page} de {Math.max(1, Math.ceil(list.data.total / list.data.pageSize))}</span>
        <button disabled={list.loading || page * list.data.pageSize >= list.data.total} onClick={() => setPage((current) => current + 1)}><span>Siguiente</span><RamaxIcon name="next" size={18} /></button>
      </nav>}
    </section>
  );
}
export function SaleDetailScreen() {
  const { id } = useParams();
  const data = useData<SaleDetail>(`/sales/${id}`);
  const mutation = useMutation();
  const admin = useStaff().user.primaryRole === "admin";
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const sale = data.data;
  async function voidSale(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason"));
    if (
      await mutation.run(`/sales/${id}/void`, {
        reason,
        refundConfirmed: confirmed,
      })
    )
      data.reload();
  }
  return (
    <section className="sales-ui sales-detail">
      <Link className="sales-back no-print" to="/ventas">
        <RamaxIcon name="back" /> Volver a ventas
      </Link>
      <Notice error={data.error ?? mutation.error} success={mutation.success} />
      {data.loading ? (
        <p>Cargando…</p>
      ) : (
        sale && (
          <>
            <header className="sales-detail-heading">
              <h1>Venta N.º {sale.saleNumber}</h1>
              <StatusPill tone={sale.status === "closed" ? "success" : "warning"}>{sale.status === "closed" ? "Finalizada" : "Anulada"}</StatusPill>
              <p>{date(sale.createdAt)} · San Luis</p>
            </header>
            <div className="split-view">
              <article className="panel receipt">
                <h2>Detalle de la venta</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Artículo</th>
                      <th>Cant.</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.productName}</td>
                        <td>{item.quantity}</td>
                        <td>{money(item.unitPriceArs)}</td>
                        <td>{money(item.subtotalArs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="cart-total">
                  Total <strong>{money(sale.totalArs)}</strong>
                </p>
                <div className="sales-receipt-meta"><div><small>Forma de pago</small><p>{sale.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}</p></div><div><small>Atendió</small><p>{sale.responsible}</p></div></div>
                {sale.status === "void" && (
                  <p>
                    Anulada por {sale.voidedBy},{" "}
                    {sale.voidedAt && date(sale.voidedAt)}. Motivo:{" "}
                    {sale.voidReason}
                  </p>
                )}
                <p>Comprobante sin validez fiscal</p>
                <button className="no-print" onClick={() => window.print()}>
                  <RamaxIcon name="print" /> Imprimir comprobante
                </button>
              </article>
              {admin && sale.status === "closed" && (
                <form className="panel sales-void no-print" onSubmit={voidSale}>
                  <h2 className="sales-void-title"><RamaxIcon name="warning" size={36} />Anular venta completa</h2>
                  <span className="status-pill">Solo administradores</span>
                  <p>Esta acción anula la venta en su totalidad y no se puede deshacer.</p>
                  <label>
                    Motivo
                    <textarea
                      name="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      minLength={3}
                      maxLength={500}
                      required
                    />
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    Confirmo que devolví {money(sale.totalArs)} por fuera de
                    Ramax
                  </label>
                  <p className="sales-void-effect">
                    Se restituirá el stock de los artículos controlados. La
                    venta original se conservará.
                  </p>
                  <button disabled={!confirmed || reason.trim().length < 3 || mutation.busy}>
                    Confirmar anulación
                  </button>
                </form>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}
