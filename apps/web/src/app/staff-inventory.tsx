import { useState, type FormEvent } from "react";
import type { SaleProduct, StaffUser, StockMovement } from "@ramax/contracts";
import { date, Notice, useData, useMutation } from "./ui";
import { useStaff } from "./staff-context";
export function StaffScreen() {
  const list = useData<StaffUser[]>("/staff");
  const mutation = useMutation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<StaffUser>();
  const [version, setVersion] = useState(0);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    const body = selected
      ? { password }
      : {
          username: String(f.get("username")),
          displayName: String(f.get("displayName")),
          role: String(f.get("role")),
          password,
        };
    if (
      await mutation.run(
        selected ? `/staff/${selected.id}/password` : "/staff",
        body,
      )
    ) {
      setSelected(undefined);
      setVersion((v) => v + 1);
      list.reload();
    }
  }
  return (
    <section>
      <h1>Equipo</h1>
      <p>Cuentas de acceso al local</p>
      <Notice error={list.error ?? mutation.error} success={mutation.success} />
      <div className="split-view">
        <div>
          <div className="filters">
            <label>
              Buscar por nombre o usuario
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Ver
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todas las cuentas</option>
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
              </select>
            </label>
          </div>
          {list.loading ? (
            <p>Cargando…</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Usuario</th>
                    <th>Perfil</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data
                    ?.filter(
                      (u) =>
                        `${u.displayName} ${u.username}`
                          .toLowerCase()
                          .includes(search.toLowerCase()) &&
                        (!status || u.active === (status === "active")),
                    )
                    .map((u) => (
                      <tr key={u.id}>
                        <td>{u.displayName}</td>
                        <td>{u.username}</td>
                        <td>
                          {u.role === "admin" ? "Administrador" : "Empleado"}
                        </td>
                        <td>{u.active ? "Activa" : "Inactiva"}</td>
                        <td>
                          <button onClick={() => setSelected(u)}>
                            Restablecer contraseña
                          </button>
                          {u.active && (
                            <button
                              disabled={mutation.busy}
                              onClick={() => {
                                if (
                                  confirm(
                                    `¿Desactivar la cuenta de ${u.displayName}? Se cerrarán sus sesiones.`,
                                  )
                                )
                                  void mutation
                                    .run(`/staff/${u.id}/deactivate`, {})
                                    .then(list.reload);
                              }}
                            >
                              Desactivar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {list.data?.length === 0 && <p>No hay cuentas.</p>}
            </div>
          )}
        </div>
        <form
          className="panel"
          onSubmit={save}
          key={`${selected?.id ?? "new"}-${version}`}
        >
          <h2>
            {selected
              ? `Restablecer: ${selected.displayName}`
              : "Agregar persona"}
          </h2>
          {!selected && (
            <>
              <label>
                Nombre
                <input name="displayName" required maxLength={160} />
              </label>
              <label>
                Usuario
                <input
                  name="username"
                  required
                  pattern="[a-zA-Z0-9._@\-]+"
                  maxLength={320}
                />
              </label>
              <label>
                Perfil
                <select name="role">
                  <option value="employee">Empleado</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
            </>
          )}
          <label>
            {selected ? "Nueva contraseña" : "Contraseña inicial"}
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <button className="button button--primary" disabled={mutation.busy}>
            {selected ? "Restablecer contraseña" : "Crear cuenta"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(undefined);
              setVersion((v) => v + 1);
            }}
          >
            Cancelar
          </button>
          <p>La cuenta del equipo es independiente de la cuenta de socio.</p>
        </form>
      </div>
    </section>
  );
}
export function InventoryScreen() {
  const products = useData<SaleProduct[]>("/products");
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState(1);
  const [sign, setSign] = useState(1);
  const mutation = useMutation();
  const admin = useStaff().user.primaryRole === "admin";
  const movements = useData<StockMovement[]>(
    `/inventory/movements${selected ? `?productId=${selected}` : ""}`,
  );
  const product = products.data?.find((p) => p.id === selected);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const reason = String(new FormData(form).get("reason"));
    if (
      await mutation.run("/inventory/adjustments", {
        productId: selected,
        delta: amount * sign,
        reason,
      })
    ) {
      products.reload();
      movements.reload();
      form.reset();
      setAmount(1);
    }
  }
  return (
    <section>
      <h1>Inventario</h1>
      <Notice
        error={products.error ?? movements.error ?? mutation.error}
        success={mutation.success}
      />
      <div className="split-view">
        <div>
          <label>
            Buscar producto
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {products.loading && <p>Cargando…</p>}
          <div className="product-list__rows">
            {products.data
              ?.filter(
                (p) =>
                  p.tracksStock &&
                  p.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  className={`inventory-row ${selected === p.id ? "is-selected" : ""}`}
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                >
                  {p.name}
                  <strong>{p.quantity} unidades</strong>
                </button>
              ))}
          </div>
          <h2>Movimientos</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Saldo</th>
                  <th>Responsable / motivo</th>
                </tr>
              </thead>
              <tbody>
                {movements.data?.map((m) => (
                  <tr key={m.id}>
                    <td>{date(m.createdAt)}</td>
                    <td>{m.productName}</td>
                    <td>
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </td>
                    <td>{m.balanceAfter}</td>
                    <td>
                      {m.responsible}
                      <small>{m.reason}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.data?.length === 0 && <p>Sin movimientos.</p>}
          </div>
        </div>
        {admin && (
          <form className="panel" onSubmit={save}>
            <h2>Ajustar stock</h2>
            <p>{product?.name ?? "Seleccioná un producto"}</p>
            <fieldset disabled={!product || mutation.busy}>
              <label>
                Tipo
                <select
                  value={sign}
                  onChange={(e) => setSign(Number(e.target.value))}
                >
                  <option value={1}>Entrada</option>
                  <option value={-1}>Salida</option>
                </select>
              </label>
              <label>
                Cantidad
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                Motivo
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={500}
                  required
                />
              </label>
              <p>
                Stock actual: {product?.quantity ?? "—"} → Stock resultante:{" "}
                {product ? product.quantity + amount * sign : "—"}
              </p>
              <button
                className="button button--primary"
                disabled={
                  !product || amount < 1 || product.quantity + amount * sign < 0
                }
              >
                Confirmar ajuste
              </button>
            </fieldset>
            <p>El ajuste quedará registrado con tu usuario.</p>
          </form>
        )}
      </div>
    </section>
  );
}
