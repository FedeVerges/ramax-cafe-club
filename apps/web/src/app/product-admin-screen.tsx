import { useState, type FormEvent } from "react";
import type { SaleProduct } from "@ramax/contracts";
import { Link, useLocation } from "react-router-dom";
import { AdminCard, AdminHeading, AdminSearch, productImageFor } from "./admin-ui";
import { RamaxIcon, StatusPill } from "./brand-ui";
import { useStaff } from "./staff-context";
import { money, Notice, useData, useMutation } from "./ui";

export function ProductsScreen() {
  const demo = useLocation().pathname.startsWith("/maquetas/admin");
  const products = useData<SaleProduct[]>("/products");
  const mutation = useMutation();
  const admin = useStaff().user.primaryRole === "admin";
  const [selectedId, setSelectedId] = useState<string | null>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("active");
  const [formVersion, setFormVersion] = useState(0);
  const items = (products.data ?? []).filter((product) =>
    `${product.name} ${product.sku ?? ""}`.toLowerCase().includes(search.toLowerCase()) &&
    (!category || product.category === category) &&
    (!status || product.status === status),
  );
  const selected = selectedId === null ? undefined :
    (products.data ?? []).find((product) => product.id === selectedId) ??
    (selectedId === undefined ? items[0] : undefined);
  const categories = [...new Set((products.data ?? []).map((product) => product.category).filter((value): value is string => Boolean(value)))];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get("name")),
      sku: String(form.get("sku")),
      category: String(form.get("category")),
      priceArs: Number(form.get("price")),
      ...(selected
        ? { active: form.get("active") === "active" }
        : { tracksStock: form.get("tracks") === "on", minimumQuantity: Number(form.get("minimum")) }),
    };
    const result = await mutation.run(selected ? `/products/${selected.id}` : "/products", body, selected ? "PATCH" : "POST");
    if (result) {
      setSelectedId(undefined);
      setFormVersion((value) => value + 1);
      products.reload();
    }
  }

  return (
    <section className="admin-page admin-products">
      <AdminHeading title="Productos" subtitle="Gestioná el catálogo de RAMAX Café & Lunch" />
      <Notice error={products.error ?? mutation.error} success={mutation.success} />
      <div className="admin-toolbar admin-products__toolbar">
        <AdminSearch value={search} onChange={setSearch} placeholder="Buscar producto..." />
        <label className="admin-filter"><span>Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="admin-filter"><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label>
        {admin && <button type="button" className="button button--primary admin-new-product" onClick={() => { setSelectedId(null); setFormVersion((value) => value + 1); }}><RamaxIcon name="plus" /> Nuevo producto</button>}
      </div>
      <div className="admin-grid admin-products__grid">
        <div className="admin-products__list">
          <div className="admin-products__head"><span>Producto</span><span>Categoría</span><span>Precio</span><span>Stock</span><span>Estado</span></div>
          {products.loading && <p className="admin-empty">Cargando productos...</p>}
          {!products.loading && items.length === 0 && <p className="admin-empty">No hay productos para estos filtros.</p>}
          {items.map((product) => (
            <button type="button" key={product.id} className={`admin-product-row${selected?.id === product.id ? " is-selected" : ""}`} onClick={() => setSelectedId(product.id)}>
              <span className="admin-product-row__name">{productImageFor(product.name) && <img src={productImageFor(product.name)} alt="" />}<strong>{product.name}</strong></span>
              <span>{product.category ?? "Sin categoría"}</span><span>{money(product.priceArs)}</span><span>{product.tracksStock ? product.quantity : "—"}</span><span><StatusPill tone={product.status === "active" ? "success" : "neutral"}>{product.status === "active" ? "Activo" : "Inactivo"}</StatusPill><RamaxIcon name="chevron" size={18} /></span>
            </button>
          ))}
        </div>
        {admin && <AdminCard title={selected ? "Editar producto" : "Nuevo producto"} className="admin-form-card admin-product-form">
          {selected && productImageFor(selected.name) && <img className="admin-product-form__photo" src={productImageFor(selected.name)} alt={selected.name} />}
          <form key={`${selected?.id ?? "new"}-${formVersion}`} onSubmit={save}>
            <label>Nombre<input name="name" defaultValue={selected?.name} maxLength={160} required /></label>
            <label>SKU opcional<input name="sku" defaultValue={selected?.sku ?? ""} maxLength={64} /></label>
            <label>Categoría<input name="category" defaultValue={selected?.category ?? ""} maxLength={100} /></label>
            <label>Precio<input name="price" type="number" min={1} step={1} defaultValue={selected?.priceArs} required /></label>
            {selected ? <>
              <div className="admin-stock-link"><label>Stock (solo lectura)<output>{selected.tracksStock ? `${selected.quantity} unidades` : "Sin control"}</output></label><Link to={demo ? "/maquetas/admin/inventario" : "/inventario"}>Ajustar inventario</Link></div>
              <label>Estado<select name="active" defaultValue={selected.status}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
            </> : <>
              <label className="checkbox-field"><input type="checkbox" name="tracks" defaultChecked /> Controlar stock</label>
              <label>Stock mínimo<input type="number" name="minimum" min={0} step={1} defaultValue={0} required /></label>
              <p className="admin-helper">El stock inicial es cero. Cargá una entrada desde Inventario.</p>
            </>}
            <button className="button button--primary" disabled={mutation.busy}>{selected ? "Guardar cambios" : "Crear producto"}</button>
            <button type="button" className="button button--secondary" onClick={() => { setSelectedId(undefined); setFormVersion((value) => value + 1); }}>Cancelar</button>
          </form>
        </AdminCard>}
      </div>
    </section>
  );
}
