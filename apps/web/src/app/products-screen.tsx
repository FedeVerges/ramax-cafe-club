import { useState, type FormEvent } from "react";
import type { SaleProduct } from "@ramax/contracts";
import { Link } from "react-router-dom";
import { useStaff } from "./staff-context";
import { money, Notice, useData, useMutation } from "./ui";
export function ProductsScreen() {
  const list = useData<SaleProduct[]>("/products");
  const mutation = useMutation();
  const admin = useStaff().user.primaryRole === "admin";
  const [selected, setSelected] = useState<SaleProduct>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [version, setVersion] = useState(0);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get("name")),
      sku: String(f.get("sku")),
      category: String(f.get("category")),
      priceArs: Number(f.get("price")),
      ...(selected
        ? { active: f.get("active") === "on" }
        : {
            tracksStock: f.get("tracks") === "on",
            minimumQuantity: Number(f.get("minimum")),
          }),
    };
    const result = await mutation.run(
      selected ? `/products/${selected.id}` : "/products",
      body,
      selected ? "PATCH" : "POST",
    );
    if (result) {
      list.reload();
      setSelected(undefined);
      setVersion((v) => v + 1);
    }
  }
  const items = (list.data ?? []).filter(
    (p) =>
      `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(search.toLowerCase()) &&
      (!category || p.category === category) &&
      (!status || p.status === status),
  );
  return (
    <section>
      <h1>Productos</h1>
      <Notice error={list.error ?? mutation.error} success={mutation.success} />
      <div className="split-view">
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
                  ...new Set(list.data?.map((p) => p.category).filter(Boolean)),
                ].map((c) => (
                  <option key={c} value={c!}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
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
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Estado</th>
                    {admin && <th>Acción</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.name}
                        <small>{p.category}</small>
                      </td>
                      <td>{money(p.priceArs)}</td>
                      <td>{p.tracksStock ? p.quantity : "No controla"}</td>
                      <td>{p.status === "active" ? "Activo" : "Inactivo"}</td>
                      {admin && (
                        <td>
                          <button onClick={() => setSelected(p)}>Editar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length && <p>No hay productos para estos filtros.</p>}
            </div>
          )}
        </div>
        {admin && (
          <form
            className="panel"
            key={`${selected?.id ?? "new"}-${version}`}
            onSubmit={save}
          >
            <h2>{selected ? "Editar producto" : "Nuevo producto"}</h2>
            <label>
              Nombre
              <input
                name="name"
                defaultValue={selected?.name}
                maxLength={160}
                required
              />
            </label>
            <label>
              SKU opcional
              <input
                name="sku"
                defaultValue={selected?.sku ?? ""}
                maxLength={64}
              />
            </label>
            <label>
              Categoría
              <input
                name="category"
                defaultValue={selected?.category ?? ""}
                maxLength={100}
              />
            </label>
            <label>
              Precio en ARS
              <input
                name="price"
                type="number"
                min={1}
                step={1}
                defaultValue={selected?.priceArs}
                required
              />
            </label>
            {selected ? (
              <>
                <label className="checkbox-field">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={selected.status === "active"}
                  />
                  Activo
                </label>
                <p>Stock: {selected.quantity} unidades</p>
                <Link to="/inventario">Ajustar inventario</Link>
              </>
            ) : (
              <>
                <label className="checkbox-field">
                  <input name="tracks" type="checkbox" defaultChecked />
                  Controlar stock
                </label>
                <label>
                  Stock mínimo
                  <input
                    name="minimum"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={0}
                    required
                  />
                </label>
                <p>
                  El stock inicial es cero. Registrá una entrada desde
                  Inventario.
                </p>
              </>
            )}
            <button className="button button--primary" disabled={mutation.busy}>
              Guardar cambios
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
          </form>
        )}
      </div>
    </section>
  );
}
