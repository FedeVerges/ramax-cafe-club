import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RamaxIcon } from "./brand-ui";
import { DemoBack, DemoButton, DemoShell } from "./mobile-demo-ui";
import "../team-demo.css";
import "../team-sale-demo.css";

const root = "/maquetas/equipo";
const route = (screen: string) => root + "/" + screen;
const pastry = "/assets/medialuna-cafe.png";
const coffee = "/assets/cappuccino-ramax.png";
const saleProducts = [
  { id: "cappuccino", name: "Cappuccino", price: 4500, image: coffee },
  { id: "medialuna", name: "Medialuna", price: 2500, image: pastry },
  { id: "cafe", name: "Café con leche", price: 4000, image: coffee },
  { id: "tostado", name: "Tostado", price: 6000, image: pastry },
];
const money = (value: number) => "$" + value.toLocaleString("es-AR");

function MemberCard({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "team-member team-member--compact" : "team-member"}><span className="team-round"><RamaxIcon name="account" size={35} /></span><div><h2>Juan Pérez</h2><span className="demo-status">Activo</span>{compact && <p>Socio 004281 · 120 puntos confirmados</p>}</div>{!compact && <dl><div><dt>Socio N.º</dt><dd>004281</dd></div><div><dt>Último saldo confirmado:</dt><dd>120 puntos</dd></div></dl>}{!compact && <small>ⓘ El saldo puede cambiar al sincronizar.</small>}</div>;
}

export function TeamDemo() {
  const navigate = useNavigate();
  const screen = useLocation().pathname.slice(root.length + 1) || "caja";
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  const [member, setMember] = useState("004281");
  const [searched, setSearched] = useState(true);
  const [ticket, setTicket] = useState("RC-7M4P9");
  const [associated, setAssociated] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({ cappuccino: 2, medialuna: 1 });
  const [productSearch, setProductSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [payment, setPayment] = useState<"Efectivo" | "Transferencia">("Efectivo");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [saleSearch, setSaleSearch] = useState("");
  const [saleDate, setSaleDate] = useState("Todas las fechas");
  const [saleVoided, setSaleVoided] = useState(false);
  const go = (next: string) => navigate(route(next));
  const ticketStates: Record<string, { title: string; description: string }> = {
    "codigo-inexistente": { title: "Código inexistente", description: "No encontramos un ticket con ese código. Revisá los caracteres con el socio e intentá de nuevo." },
    "ticket-vencido": { title: "Ticket vencido", description: "Este ticket superó su fecha y hora de vencimiento. Ya no se puede entregar el beneficio." },
    "ticket-cancelado": { title: "Ticket cancelado", description: "Este canje fue cancelado por el socio. El beneficio ya no se puede entregar." },
    "ticket-utilizado": { title: "Ticket ya utilizado", description: "Este beneficio ya fue entregado. El ticket no puede volver a validarse." },
  };
  const ticketState = ticketStates[screen];
  const isTicketSearch = screen === "canjes" || Boolean(ticketState);
  const active = ["asociar", "ventas", "detalle-venta"].includes(screen) ? "ventas" : isTicketSearch || ["entregar", "cancelar"].includes(screen) ? "canjes" : "caja";
  const offline = screen === "socio-sin-conexion";
  const selected = saleProducts.filter((product) => (quantities[product.id] ?? 0) > 0);
  const total = selected.reduce((sum, product) => sum + product.price * (quantities[product.id] ?? 0), 0);
  const units = selected.reduce((sum, product) => sum + (quantities[product.id] ?? 0), 0);
  const change = (id: string, delta: number) => setQuantities((current) => ({ ...current, [id]: Math.max(0, Math.min(12, (current[id] ?? 0) + delta)) }));

  let content: React.ReactNode;
  if (screen === "caja") content = <>
    <h1>Buen turno, Lucía</h1><p>Caja de hoy</p>
    <DemoButton onClick={() => go("productos-venta")}><span className="team-action-icon">+</span>Nueva venta <RamaxIcon name="next" /></DemoButton>
    <div className="team-home-actions"><Link to={route("buscar-socio")}><RamaxIcon name="account" size={40} /><strong>Buscar socio</strong><span>Ingresá el número de 6 dígitos</span><RamaxIcon name="chevron" /></Link><Link to={route("canjes")}><RamaxIcon name="ticket" size={40} /><strong>Validar canje</strong><span>Ingresá el código del ticket</span><RamaxIcon name="chevron" /></Link></div>
    <Link className="team-recent-link" to={route("ventas")}><RamaxIcon name="receipt" size={37} /><span><strong>Ventas recientes</strong><small>Consultá las últimas ventas</small></span><RamaxIcon name="chevron" /></Link>
    <div className="team-latest"><span>Última venta</span><strong>$8.500</strong><p>N.º 247 · 12:34<br />Transferencia<br /><b>Cappuccino</b>　+1</p><small>4 oct 2026 · San Luis</small></div>
  </>;
  else if (screen === "productos-venta") content = <>
    <h1>Nueva venta</h1>
    <div className="team-product-search"><RamaxIcon name="search" /><input aria-label="Buscar producto" placeholder="Buscar producto" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />{productSearch && <button aria-label="Limpiar búsqueda" onClick={() => setProductSearch("")}>×</button>}</div>
    <div className="demo-pills team-categories">{["Todos", "Cafés", "Comida"].map((item) => <button key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="team-products">{saleProducts.filter((product) => product.name.toLowerCase().includes(productSearch.toLowerCase()) && (category === "Todos" || (category === "Cafés" ? product.id === "cappuccino" || product.id === "cafe" : product.id === "medialuna" || product.id === "tostado"))).map((product) => <div className="team-product-row" key={product.id}><span><strong>{product.name}</strong><small>{money(product.price)}</small></span><div>{(quantities[product.id] ?? 0) > 0 && <><button aria-label={"Quitar " + product.name} onClick={() => change(product.id, -1)}>−</button><b>{quantities[product.id]}</b></>}<button className="is-add" aria-label={"Agregar " + product.name} onClick={() => change(product.id, 1)}>+</button></div></div>)}</div>
    <div className="team-sale-dock"><span><small>{units} unidades</small><strong>Total {money(total)}</strong></span><DemoButton disabled={units === 0} onClick={() => go("revisar-venta")}>Ver pedido <RamaxIcon name="next" /></DemoButton></div>
  </>;
  else if (screen === "revisar-venta") content = <>
    <h1>Revisar venta</h1><div className="team-review-lines">{selected.map((product) => <div className="team-review-row" key={product.id}><img src={product.image} alt="" /><span><strong>{product.name}</strong><small>{money(product.price)} c/u</small></span><div><button aria-label={"Quitar " + product.name} onClick={() => change(product.id, -1)}>−</button><b>{quantities[product.id]}</b><button className="is-add" aria-label={"Agregar " + product.name} onClick={() => change(product.id, 1)}>+</button></div><strong>{money(product.price * (quantities[product.id] ?? 0))}</strong></div>)}</div>
    <button className="team-add-products" onClick={() => go("productos-venta")}><RamaxIcon name="plus" />Agregar productos</button>
    <section className="team-review-member"><div><strong>Socio</strong><small>Opcional</small></div><button onClick={() => go("buscar-socio")}><RamaxIcon name="account" />{associated ? "Juan Pérez · 004281" : "Asociar número de socio"}<RamaxIcon name="next" /></button></section>
    <section className="team-review-total"><div><strong>Total</strong><b>{money(total)}</b></div><p><RamaxIcon name="points" />+{Math.round(total / 100)} puntos estimados <small>Se confirman después de sincronizar la venta.</small></p></section>
    <DemoButton disabled={units === 0} onClick={() => go("cobrar-venta")}>Continuar al cobro <RamaxIcon name="next" /></DemoButton>
  </>;
  else if (screen === "cobrar-venta") content = <>
    <DemoBack to={route("revisar-venta")}>Revisar venta</DemoBack><h1>Cobrar venta</h1>
    <button className="team-payment-member" onClick={() => go("buscar-socio")}><span className="team-round"><RamaxIcon name="account" /></span><span><strong>Juan Pérez · Socio 004281</strong><small>+{Math.round(total / 100)} puntos al confirmarse en el club</small></span><RamaxIcon name="chevron" /></button>
    <h2 className="team-subheading">Resumen de productos</h2><div className="demo-card team-payment-lines">{selected.map((product) => <div key={product.id}><strong>{quantities[product.id]} × {product.name}</strong><strong>{money(product.price * (quantities[product.id] ?? 0))}</strong></div>)}</div>
    <div className="team-payment-total"><strong>Total</strong><b>{money(total)}</b></div>
    <h2 className="team-subheading">Forma de pago</h2><div className="team-payment-methods">{(["Efectivo", "Transferencia"] as const).map((method) => <button key={method} className={payment === method ? "is-active" : ""} onClick={() => { setPayment(method); setPaymentConfirmed(false); }}><RamaxIcon name={method === "Efectivo" ? "register" : "sales"} size={31} />{method}</button>)}</div>
    {payment === "Transferencia" && <label className="team-transfer-confirm"><input type="checkbox" checked={paymentConfirmed} onChange={(event) => setPaymentConfirmed(event.target.checked)} />Confirmo que recibí la transferencia.</label>}
    <p className="team-payment-note">ⓘ　Al confirmar, la venta se cierra y descuenta stock.</p>
    <DemoButton disabled={payment === "Transferencia" && !paymentConfirmed} onClick={() => go("venta-registrada")}>Confirmar venta · {money(total)} <RamaxIcon name="next" /></DemoButton><small className="team-once">Se registra una sola vez.</small>
  </>;
  else if (screen === "venta-registrada") content = <>
    <div className="team-registered"><span><RamaxIcon name="confirmed" size={43} /></span><h1>Venta registrada</h1><h2>N.º 248</h2><p>4 oct 2026 · 13:32 · San Luis</p></div>
    <div className="team-payment-lines team-registered-lines">{selected.map((product) => <div key={product.id}><strong>{quantities[product.id]} × {product.name}</strong><strong>{money(product.price * (quantities[product.id] ?? 0))}</strong></div>)}</div>
    <div className="team-payment-total"><strong>Total</strong><b>{money(total)}</b></div>
    <div className="team-registered-meta"><span>Pago <strong>{payment}</strong></span><span>Socio <strong>••4281</strong></span></div>
    <div className="team-pending demo-note"><RamaxIcon name="warning" /><span><strong>{Math.round(total / 100)} puntos pendientes de sincronizar</strong><br />La venta ya está cerrada. Los puntos aparecerán al volver la conexión.</span></div>
    <div className="team-actions"><DemoButton onClick={() => { setQuantities({}); go("productos-venta"); }}>Nueva venta <RamaxIcon name="next" /></DemoButton><DemoButton secondary onClick={() => go("detalle-venta")}><RamaxIcon name="print" />Imprimir comprobante</DemoButton></div><small className="team-once">Comprobante sin validez fiscal.</small>
  </>;
  else if (screen === "ventas") content = <>
    <h1>Ventas</h1><p>Historial de ventas</p><div className="team-sales-filters"><label><RamaxIcon name="search" /><input aria-label="Buscar número de venta" placeholder="Buscar N.º de venta" value={saleSearch} onChange={(event) => setSaleSearch(event.target.value)} /></label><select aria-label="Fecha de ventas" value={saleDate} onChange={(event) => setSaleDate(event.target.value)}><option>Todas las fechas</option><option>Hoy</option><option>Ayer</option></select></div>
    <div className="team-sales-list">{[[249, "14:10", 7000, "Efectivo", "Sin socio"], [248, "13:32", 11500, "Efectivo", "Socio •••4281"], [247, "12:34", 8500, "Transferencia", "Sin socio"], [246, "18:20", 6800, "Efectivo", "Socio •••7329"], [245, "16:05", 13200, "Transferencia", "Sin socio"]].filter(([number], index) => String(number).includes(saleSearch) && (saleDate === "Todas las fechas" || (saleDate === "Hoy" ? index < 3 : index >= 3))).map(([number, time, amount, method, member], index) => <div key={number}><small className="team-sales-date">{Number(number) >= 247 ? "HOY, 4 DE OCTUBRE DE 2026" : "AYER, 3 DE OCTUBRE DE 2026"}</small><button className="team-sale-item" onClick={() => go("detalle-venta")}><span>N.º {number} · {time}<small>{method}<br />♙　{member}</small></span><strong>{money(Number(amount))}</strong><RamaxIcon name="chevron" /></button>{index === 0 && <button className="team-late-link" onClick={() => go("asociar")}><RamaxIcon name="people" />Asociar socio (24 h)</button>}{Number(number) === 248 && <small className="team-pending-tag">◷　Puntos pendientes (115)</small>}</div>)}</div>
  </>;
  else if (screen === "detalle-venta") content = <>
    <DemoBack to={route("ventas")}>Ventas</DemoBack><h1>Venta N.º 248</h1><span className="demo-status">{saleVoided ? "Anulada" : "Finalizada"}</span><p className="team-detail-meta">4 oct 2026 · 13:32　·　San Luis</p>
    <section className="demo-card team-detail-sale"><h2>Detalle de la venta</h2>{selected.map((product) => <div key={product.id}><span>{product.name}</span><span>{quantities[product.id]}</span><span>{money(product.price)}</span><strong>{money(product.price * (quantities[product.id] ?? 0))}</strong></div>)}<footer>Total <strong>{money(total)}</strong></footer><p>Forma de pago: {payment} · Atendió Lucía</p><DemoButton secondary onClick={() => window.print()}><RamaxIcon name="print" />Imprimir comprobante</DemoButton></section>
    <section className="demo-card team-void"><h2>Anular venta completa</h2><p>Esta acción anula la venta en su totalidad y no puede deshacerse.</p><label className="demo-field">Motivo de anulación<select><option>Venta registrada por error</option><option>Pedido duplicado</option></select></label><label className="team-transfer-confirm"><input type="checkbox" id="team-void-confirm" />Confirmo que cobré {money(total)} por Ramax.</label><div className="demo-note">Efecto de la anulación: se devolverán las unidades al stock.</div><DemoButton onClick={() => setSaleVoided(true)}>{saleVoided ? "Venta anulada" : "Confirmar anulación"}</DemoButton></section>
  </>;
  else if (screen === "buscar-socio" || offline) content = <>
    <DemoBack to={route("caja")}>Revisar venta</DemoBack><h1>Buscar socio</h1><p>Ingresá los 6 dígitos que muestra el socio.</p>
    <div className="team-large-input"><input aria-label="Número de socio" value={member} maxLength={6} inputMode="numeric" onChange={(event) => { setMember(event.target.value.replace(/\D/g, "")); setSearched(false); }} /><button aria-label="Borrar número" onClick={() => { setMember(""); setSearched(false); }}>×</button></div>
    <DemoButton disabled={member.length !== 6} onClick={() => setSearched(true)}><RamaxIcon name="search" size={23} />Buscar socio</DemoButton>
    {offline ? <div className="team-offline demo-card"><span className="team-round"><RamaxIcon name="account" size={49} /></span><h2>Socio no disponible en este dispositivo</h2><p>Sin conexión no podemos consultar socios que no estén guardados.</p><div>ⓘ Podés cerrar la venta sin socio y asociarla dentro de las 24 h cuando vuelva internet.</div></div> : searched && member === "004281" ? <MemberCard /> : searched && <div className="team-alert demo-card"><RamaxIcon name="warning" size={35} /><span><strong>Socio no encontrado</strong><small>Revisá el número e intentá de nuevo.</small></span></div>}
    {offline ? <DemoButton onClick={() => go("cobrar-venta")}>Seguir sin socio <RamaxIcon name="next" /></DemoButton> : searched && member === "004281" && <div className="team-actions"><DemoButton onClick={() => { setAssociated(true); go("revisar-venta"); }}>Asociar a esta venta <RamaxIcon name="next" /></DemoButton><DemoButton secondary onClick={() => go("revisar-venta")}>Seguir sin socio</DemoButton></div>}
    <button className="team-example-link" onClick={() => go(offline ? "buscar-socio" : "socio-sin-conexion")}>{offline ? "Ver socio conectado" : "Ver ejemplo sin conexión"}</button>
  </>;
  else if (screen === "asociar") content = <>
    <DemoBack to={route("ventas")}>Volver a la venta</DemoBack><h1>Asociar socio a la venta</h1>
    <section className="demo-card team-sale-card"><RamaxIcon name="receipt" size={38} /><div><strong>Venta N.º 249 · $7.000</strong><p>Cerrada 4 oct 2026 · 14:10</p><span>{associated ? "Socio 004281" : "Sin socio"}</span></div><small>ⓘ Podés asociarlo hasta el 5 oct · 14:10 (24 horas desde el cierre).</small></section>
    <label className="demo-field">Número de socio<input value={member} maxLength={6} onChange={(event) => setMember(event.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label>
    {member === "004281" && <><MemberCard compact /><div className="demo-note team-points-note"><RamaxIcon name="points" weight="fill" />Se acreditarán 70 puntos con la regla guardada al cerrar esta venta.</div></>}
    <div className="team-actions"><DemoButton disabled={member !== "004281"} onClick={() => setAssociated(true)}>{associated ? "Socio asociado" : "Confirmar asociación"} <RamaxIcon name="next" /></DemoButton><DemoButton secondary onClick={() => go("ventas")}>Volver a la venta</DemoButton></div>
  </>;
  else if (isTicketSearch) content = <>
    <h1>Validar canje</h1><p>Pedile al socio el código de su ticket.</p>
    <label className="team-code-label">Código de canje</label><div className="team-large-input"><input aria-label="Código de canje" value={ticket} onChange={(event) => setTicket(event.target.value.toUpperCase())} /><button aria-label="Borrar código" onClick={() => setTicket("")}>×</button></div>
    <DemoButton disabled={!ticket.trim()} onClick={() => go(ticket.toUpperCase() === "RC-7M4P9" ? "entregar" : "codigo-inexistente")}><RamaxIcon name="search" size={24} />Buscar ticket</DemoButton>
    {ticketState && <div className={"team-alert demo-card" + (screen === "codigo-inexistente" || screen === "ticket-vencido" ? " team-alert--warning" : "")}><span className="team-round"><RamaxIcon name="warning" size={38} /></span><span><strong>{ticketState.title}</strong><small>{ticketState.description}</small>{screen === "ticket-utilizado" && <small>Entregado el 4 oct 2026 · 11:20</small>}</span></div>}
    <p className="team-online-note">ⓘ　Esta consulta necesita internet.</p>
    {!ticketState && <section className="team-recent-redemption"><h2>Últimos canjes</h2><Link to={route("ticket-utilizado")}>Ver todos <RamaxIcon name="chevron" /></Link><button onClick={() => go("ticket-utilizado")}><span className="team-round"><RamaxIcon name="products" /></span><span><strong>RC-4K2Q8</strong><small>Café de regalo<br />4 oct 2026 · 11:20 · San Luis</small></span><em>✓ Entregado</em></button></section>}
    {ticketState && <div className="team-state-links">Ver estados: {Object.entries(ticketStates).map(([state, detail]) => <Link key={state} to={route(state)}>{detail.title}</Link>)}</div>}
  </>;
  else if (screen === "entregar" || screen === "cancelar") content = <>
    <DemoBack to={route("canjes")}>Buscar otro ticket</DemoBack><h1>Entregar beneficio</h1>
    <div className="team-ready"><RamaxIcon name="confirmed" size={24} />{delivered ? "ENTREGADO" : cancelled ? "CANCELADO" : "LISTO PARA RETIRAR"}</div>
    <div className="demo-card team-ticket-code"><span>Código de canje</span><strong>RC-7M4P9</strong></div>
    <section className="demo-card team-ticket-detail"><div><span className="team-round"><RamaxIcon name="account" /></span><p><strong>Juan Pérez</strong><small>Socio 004281</small></p></div><div><img src={pastry} alt="" /><strong>1 medialuna clásica</strong></div><div><span className="team-round"><RamaxIcon name="products" /></span><p><small>Cantidad a entregar</small><strong>1</strong></p></div><div><span className="team-round"><RamaxIcon name="calendar" /></span><p><small>Vence</small><span>5 oct 2026 · 16:40</span></p></div></section>
    <div className="demo-note">ⓘ　Entregá la cantidad completa <strong>antes de validar.</strong> Solo se puede validar una vez.</div>
    <div className="team-actions"><DemoButton disabled={delivered || cancelled} onClick={() => setDelivered(true)}><RamaxIcon name="confirmed" />{delivered ? "Entrega confirmada" : "Confirmar entrega de 1 unidad"}</DemoButton><DemoButton secondary onClick={() => go("cancelar")}>Cancelar ticket</DemoButton></div>
    {screen === "cancelar" && <div className="team-modal-backdrop"><section className="team-modal" role="dialog" aria-modal="true" aria-label="Cancelar este ticket"><span className="team-modal__handle" /><h2>¿Cancelar este ticket?</h2><p>Código de canje</p><strong>RC-7M4P9</strong><p>El beneficio ya no podrá entregarse.<br />Esta acción devolverá los puntos al socio.</p><DemoButton secondary onClick={() => go("entregar")}>Volver, no cancelar</DemoButton><DemoButton onClick={() => { setCancelled(true); go("entregar"); }}>Sí, cancelar ticket</DemoButton></section></div>}
  </>;
  else content = <><h1>Pantalla no encontrada</h1><DemoButton onClick={() => go("caja")}>Ir a caja</DemoButton></>;
  return <DemoShell area="equipo" active={active} offline={offline}>{content}</DemoShell>;
}
