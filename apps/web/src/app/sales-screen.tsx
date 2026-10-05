import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { Page, SaleDetail, SaleSummary } from "@ramax/contracts";
import { date, money, Notice, useData, useMutation } from "./ui";
import { useStaff } from "./staff-context";
export function SalesScreen() {
  const [filters, setFilters] = useState("");
  const [page, setPage] = useState(1);
  const list = useData<Page<SaleSummary>>(`/sales?page=${page}&${filters}`);
  function filter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of f)
      if (value)
        params.set(
          key,
          key === "from"
            ? `${value}T00:00:00-03:00`
            : key === "to"
              ? `${value}T23:59:59.999-03:00`
              : String(value),
        );
    setPage(1);
    setFilters(params.toString());
  }
  return (
    <section>
      <h1>Ventas</h1>
      <form className="filters" onSubmit={filter}>
        <label>
          Número
          <input type="number" min={1} name="number" />
        </label>
        <label>
          Desde
          <input type="date" name="from" />
        </label>
        <label>
          Hasta
          <input type="date" name="to" />
        </label>
        <label>
          Estado
          <select name="status">
            <option value="">Todos</option>
            <option value="closed">Finalizada</option>
            <option value="void">Anulada</option>
          </select>
        </label>
        <label>
          Pago
          <select name="paymentMethod">
            <option value="">Todos</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
          </select>
        </label>
        <button>Filtrar</button>
      </form>
      <Notice error={list.error} />
      {list.loading ? (
        <p>Cargando…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Estado</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/ventas/${s.id}`}>Venta N.º {s.saleNumber}</Link>
                  </td>
                  <td>{date(s.createdAt)}</td>
                  <td>{money(s.totalArs)}</td>
                  <td>
                    {s.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}
                  </td>
                  <td>{s.status === "closed" ? "Finalizada" : "Anulada"}</td>
                  <td>{s.responsible}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.data?.items.length === 0 && (
            <p>No hay ventas para estos filtros.</p>
          )}
        </div>
      )}
      <div className="filters">
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </button>
        <span>
          Página {page} · {list.data?.total ?? 0} ventas
        </span>
        <button
          disabled={!list.data || page * list.data.pageSize >= list.data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
export function SaleDetailScreen() {
  const { id } = useParams();
  const data = useData<SaleDetail>(`/sales/${id}`);
  const mutation = useMutation();
  const admin = useStaff().user.primaryRole === "admin";
  const [confirmed, setConfirmed] = useState(false);
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
    <section>
      <Link className="no-print" to="/ventas">
        ← Volver a ventas
      </Link>
      <Notice error={data.error ?? mutation.error} success={mutation.success} />
      {data.loading ? (
        <p>Cargando…</p>
      ) : (
        sale && (
          <>
            <div className="split-view">
              <article className="panel receipt">
                <h1>RAMAX</h1>
                <h2>Venta N.º {sale.saleNumber}</h2>
                <p>
                  {date(sale.createdAt)} ·{" "}
                  {sale.status === "closed" ? "Finalizada" : "Anulada"}
                </p>
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
                <p>
                  Pago:{" "}
                  {sale.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}
                </p>
                <p>Atendió: {sale.responsible}</p>
                {sale.status === "void" && (
                  <p>
                    Anulada por {sale.voidedBy},{" "}
                    {sale.voidedAt && date(sale.voidedAt)}. Motivo:{" "}
                    {sale.voidReason}
                  </p>
                )}
                <p>Comprobante sin validez fiscal</p>
                <button className="no-print" onClick={() => window.print()}>
                  Imprimir comprobante
                </button>
              </article>
              {admin && sale.status === "closed" && (
                <form className="panel no-print" onSubmit={voidSale}>
                  <h2>Anular venta completa</h2>
                  <label>
                    Motivo
                    <textarea
                      name="reason"
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
                  <p>
                    Se restituirá el stock de los artículos controlados. La
                    venta original se conservará.
                  </p>
                  <button disabled={!confirmed || mutation.busy}>
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
