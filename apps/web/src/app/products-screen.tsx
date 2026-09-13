import { useEffect, useState, type FormEvent } from "react";
import type { CreateProductInput, SaleProduct } from "@ramax/contracts";
import { Link } from "react-router-dom";
import { createProduct, getSaleProducts } from "./session.ts";

function formatArs(amount: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
}

const initialProduct: CreateProductInput = {
  name: "",
  sku: "",
  category: "",
  priceArs: 0,
  tracksStock: true,
  initialQuantity: 0,
  minimumQuantity: 0,
};

export function ProductsScreen() {
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [form, setForm] = useState<CreateProductInput>(initialProduct);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState(false);

  useEffect(() => {
    void getSaleProducts()
      .then(setProducts)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No pudimos cargar los productos."))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof CreateProductInput>(key: K, value: CreateProductInput[K]) {
    setCreated(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    setCreated(false);
    try {
      await createProduct({
        ...form,
        sku: form.sku?.trim() || undefined,
        category: form.category?.trim() || undefined,
        initialQuantity: form.tracksStock ? form.initialQuantity : 0,
        minimumQuantity: form.tracksStock ? form.minimumQuantity : 0,
      });
      const list = await getSaleProducts();
      setProducts(list);
      setForm(initialProduct);
      setCreated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos crear el producto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="products-screen" aria-labelledby="products-title">
      <Link className="back-link" to="/admin">← Volver a administración</Link>
      <p className="eyebrow">CATÁLOGO Y STOCK</p>
      <h1 id="products-title">Productos</h1>
      <div className="products-layout">
        <form className="product-form" onSubmit={submit}>
          <h2>Nuevo producto</h2>
          <label>Nombre<input required maxLength={160} value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label>SKU opcional<input maxLength={64} value={form.sku} onChange={(event) => update("sku", event.target.value)} /></label>
          <label>Categoría<input maxLength={100} value={form.category} onChange={(event) => update("category", event.target.value)} /></label>
          <label>Precio final en ARS<input required min={1} step={1} type="number" value={form.priceArs || ""} onChange={(event) => update("priceArs", Number(event.target.value))} /></label>
          <label className="checkbox-field"><input type="checkbox" checked={form.tracksStock} onChange={(event) => update("tracksStock", event.target.checked)} /> Controlar stock de este producto</label>
          {form.tracksStock ? <div className="form-two-columns">
            <label>Stock inicial<input required min={0} step={1} type="number" value={form.initialQuantity} onChange={(event) => update("initialQuantity", Number(event.target.value))} /></label>
            <label>Alerta mínima<input required min={0} step={1} type="number" value={form.minimumQuantity} onChange={(event) => update("minimumQuantity", Number(event.target.value))} /></label>
          </div> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {created ? <p className="form-success" role="status">Producto creado y disponible para vender.</p> : null}
          <button className="button button--primary" disabled={saving} type="submit">{saving ? "Guardando..." : "Crear producto"} <span aria-hidden="true">+</span></button>
        </form>
        <section className="product-list" aria-label="Productos registrados">
          <div className="section-heading"><div><p className="eyebrow">CATÁLOGO ACTUAL</p><h2>{products.length} productos</h2></div></div>
          {loading ? <p className="helper-text">Cargando productos...</p> : null}
          <div className="product-list__rows">
            {products.map((product) => <article key={product.id} className="product-list__row">
              <div><h3>{product.name}</h3><p>{product.category ?? "Sin categoría"}{product.sku ? ` · ${product.sku}` : ""}</p></div>
              <div className="product-list__numbers"><strong>{formatArs(product.priceArs)}</strong><span>{product.tracksStock ? `${product.quantity} en stock` : "Sin stock"}</span></div>
            </article>)}
          </div>
        </section>
      </div>
    </section>
  );
}
