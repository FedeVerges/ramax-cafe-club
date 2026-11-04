import { useState, type FormEvent } from "react";
import type { SaleProduct, StockMovement } from "@ramax/contracts";
import { AdminCard, AdminHeading, AdminSearch, productImageFor } from "./admin-ui";
import { RamaxIcon } from "./brand-ui";
import { useStaff } from "./staff-context";
import { date, Notice, useData, useMutation } from "./ui";

export function InventoryScreen() {
  const products = useData<SaleProduct[]>("/products");
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState(1);
  const [sign, setSign] = useState<1 | -1>(-1);
  const [reason, setReason] = useState("Merma por rotura");
  const [customReason, setCustomReason] = useState("");
  const mutation = useMutation();
  const admin = useStaff().user.primaryRole === "admin";
  const tracked = (products.data ?? []).filter((product) => product.tracksStock);
  const selected = tracked.find((product) => product.id === selectedId) ?? tracked[0];
  const movements = useData<StockMovement[]>(`/inventory/movements${selected ? `?productId=${selected.id}` : ""}`);
  const visible = tracked.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()));
  const resulting = selected ? selected.quantity + amount * sign : undefined;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || resulting === undefined || resulting < 0) return;
    const result = await mutation.run("/inventory/adjustments", {
      productId: selected.id,
      delta: amount * sign,
      reason: reason === "Otro motivo" ? customReason.trim() : reason,
    });
    if (result) {
      products.reload();
      movements.reload();
      setAmount(1);
      setCustomReason("");
    }
  }

  return (
    <section className="admin-page admin-inventory">
      <AdminHeading title="Inventario" subtitle="Gestioná el stock de productos del local." />
      <Notice error={products.error ?? movements.error ?? mutation.error} success={mutation.success} />
      <div className="admin-inventory__grid">
        <div className="admin-inventory__left">
          <AdminCard className="admin-inventory__products">
            <AdminSearch value={search} onChange={setSearch} placeholder="Buscar producto..." />
            <div className="admin-inventory__rows">
              {visible.map((product) => (
                <button type="button" key={product.id} className={`admin-inventory__row${selected?.id === product.id ? " is-selected" : ""}`} onClick={() => { setSelectedId(product.id); setAmount(1); }}>
                  {productImageFor(product.name) && <img src={productImageFor(product.name)} alt="" />}
                  <span>{product.name}</span><strong>{product.quantity}<small>unidades</small></strong>
                </button>
              ))}
              {products.loading && <p className="admin-empty">Cargando productos...</p>}
              {!products.loading && visible.length === 0 && <p className="admin-empty">No hay productos para esta búsqueda.</p>}
            </div>
          </AdminCard>
          <AdminCard title="Ajustes recientes" className="admin-inventory__history">
            <div className="admin-table-wrap"><table><thead><tr><th>Fecha</th><th>Responsable</th><th>Cantidad</th><th>Motivo</th></tr></thead><tbody>{(movements.data ?? []).map((movement) => <tr key={movement.id}><td>{date(movement.createdAt)}</td><td>{movement.responsible ?? "Sistema"}</td><td className={movement.delta < 0 ? "admin-negative" : "admin-positive"}>{movement.delta > 0 ? "+" : ""}{movement.delta}</td><td>{movement.reason ?? "—"}</td></tr>)}</tbody></table>{!movements.loading && !movements.data?.length && <p className="admin-empty">Sin movimientos para este producto.</p>}</div>
          </AdminCard>
        </div>
        <AdminCard className="admin-inventory__form">
          {selected ? <>
            <div className="admin-inventory__product"><span>{productImageFor(selected.name) && <img src={productImageFor(selected.name)} alt={selected.name} />}</span><div><h2>{selected.name}</h2><p>{selected.category ?? "Producto del local"}</p></div></div>
            {admin ? <form onSubmit={save}>
              <h2><RamaxIcon name="edit" size={24} /> Ajustar stock</h2>
              <fieldset disabled={mutation.busy}>
                <legend>Tipo de movimiento</legend>
                <div className="admin-inventory__movement"><label className={sign === 1 ? "is-selected" : ""}><input type="radio" name="sign" checked={sign === 1} onChange={() => setSign(1)} /><span><strong>Entrada</strong><small>Aumenta el stock</small></span></label><label className={sign === -1 ? "is-selected" : ""}><input type="radio" name="sign" checked={sign === -1} onChange={() => setSign(-1)} /><span><strong>Salida</strong><small>Disminuye el stock</small></span></label></div>
                <label>Cantidad<input type="number" min={1} step={1} max={sign === -1 ? selected.quantity : undefined} value={amount} onChange={(event) => setAmount(Number(event.target.value))} required /></label>
                <label>Motivo<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Merma por rotura</option><option>Recepción de mercadería</option><option>Producción propia</option><option>Corrección de inventario</option><option>Otro motivo</option></select></label>
                {reason === "Otro motivo" && <label>Describí el motivo<textarea value={customReason} onChange={(event) => setCustomReason(event.target.value)} minLength={3} maxLength={500} required /></label>}
                <div className="admin-inventory__preview"><div><span>Stock actual</span><strong>{selected.quantity}</strong><small>unidades</small></div><RamaxIcon name="next" size={30} /><div><span>Stock resultante</span><strong>{resulting ?? "—"}</strong><small>unidades</small></div></div>
                <button className="button button--primary" disabled={!Number.isInteger(amount) || amount < 1 || (resulting ?? -1) < 0 || (reason === "Otro motivo" && customReason.trim().length < 3)}>Confirmar ajuste</button>
                <button type="button" className="button button--secondary" onClick={() => { setAmount(1); setSign(-1); setReason("Merma por rotura"); setCustomReason(""); }}>Cancelar</button>
              </fieldset>
              <p className="admin-helper">El ajuste quedará registrado con tu usuario.</p>
            </form> : <p>Solo el Administrador puede ajustar el stock.</p>}
          </> : <p>Seleccioná un producto con control de stock.</p>}
        </AdminCard>
      </div>
    </section>
  );
}
