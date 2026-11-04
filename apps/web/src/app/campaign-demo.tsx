import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RamaxIcon } from "./brand-ui";
import { DemoBack, DemoButton, DemoShell } from "./mobile-demo-ui";
import "../campaign-demo.css";

const root = "/maquetas/campanias";
const route = (screen: string) => root + "/" + screen;

function BarChart({ title, values, labels }: { title: string; values: number[]; labels: string[] }) {
  const max = Math.max(...values);
  return <section className="demo-chart"><h2>{title}</h2><div className="demo-chart__bars">{values.map((value, index) => <div key={labels[index]}><strong>{title.startsWith("Ventas") ? "$" + value.toLocaleString("es-AR") : value}</strong><i style={{ height: 120 * value / max + "px" }} /></div>)}</div><div className="demo-chart__labels">{labels.map((label) => <span key={label}>{label}</span>)}</div></section>;
}

export function CampaignDemo() {
  const navigate = useNavigate();
  const screen = useLocation().pathname.slice(root.length + 1) || "listado";
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  const [filter, setFilter] = useState("Todas");
  const [period, setPeriod] = useState("Hoy · 4 oct");
  const [name, setName] = useState("Semana del café");
  const [description, setDescription] = useState("Escaneá en el local y sumá puntos");
  const [start, setStart] = useState("2026-10-05");
  const [end, setEnd] = useState("2026-10-31");
  const [entry, setEntry] = useState("QR reutilizable en el local");
  const [benefit, setBenefit] = useState<"Puntos" | "Recompensa">("Puntos");
  const [points, setPoints] = useState(50);
  const [limit, setLimit] = useState(200);
  const [onePerMember, setOnePerMember] = useState(true);
  const [saved, setSaved] = useState(false);
  const go = (next: string) => navigate(route(next));
  const active = screen === "datos" ? "datos" : "campanias";

  let content: React.ReactNode;
  if (screen === "listado") content = <>
    <h1>Campañas</h1>
    <DemoButton onClick={() => go("nueva")}><span className="campaign-plus">+</span>Nueva campaña <RamaxIcon name="next" size={22} /></DemoButton>
    <div className="demo-pills">{["Todas", "Activas", "Borradores"].map((item) => <button key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
    {filter !== "Borradores" && <article className="campaign-list-item"><button className="campaign-list-item__title" onClick={() => go("resultados")}>Octubre con Ramax <RamaxIcon name="chevron" /></button><span className="demo-status">Activa</span><p><RamaxIcon name="calendar" />1 – 31 oct 2026</p><p><span className="campaign-round"><RamaxIcon name="points" weight="fill" /></span><span><strong>+50 puntos</strong><small>por participar desde el QR</small></span></p><p><RamaxIcon name="people" />32 participaciones</p><DemoButton secondary onClick={() => go("resultados")}>Ver resultados <RamaxIcon name="next" /></DemoButton></article>}
    {filter !== "Activas" && <article className="campaign-list-item"><button className="campaign-list-item__title" onClick={() => go("nueva")}>{saved ? name : "Semana del café"} <RamaxIcon name="chevron" /></button><span className="demo-status demo-status--draft">Borrador</span><p><RamaxIcon name="calendar" />Sin publicar</p><p><span className="campaign-round"><RamaxIcon name="rewards" /></span><span><strong>+{points} puntos</strong><small>por participación</small></span></p></article>}
  </>;
  else if (screen === "nueva") content = <>
    <DemoBack to={route("listado")}>Campañas</DemoBack><h1>Nueva campaña</h1><p className="campaign-step">1 de 2 · Datos básicos</p><div className="campaign-progress"><span style={{ width: "50%" }} /></div>
    <label className="demo-field">Nombre de la campaña *<input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className="demo-field">Descripción (opcional)<input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <div className="campaign-dates"><label className="demo-field">Empieza *<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label className="demo-field">Termina *<input type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)} /></label></div>
    <label className="demo-field">Punto de entrada *<select value={entry} onChange={(event) => setEntry(event.target.value)}><option>QR reutilizable en el local</option><option>Enlace compartible</option></select><small>Un mismo QR puede abrir la campaña para muchas personas.</small></label>
    <div className="campaign-actions"><DemoButton disabled={!name.trim() || !start || !end || end < start} onClick={() => go("beneficio")}>Continuar al beneficio <RamaxIcon name="next" /></DemoButton><DemoButton secondary onClick={() => { setSaved(true); go("listado"); }}>Guardar borrador</DemoButton></div>
  </>;
  else if (screen === "beneficio") content = <>
    <DemoBack to={route("nueva")}>Datos básicos</DemoBack><h1>Beneficio de la campaña</h1><p className="campaign-step">2 de 2 · Beneficio</p><div className="campaign-progress"><span /></div>
    <div className="demo-note campaign-summary"><RamaxIcon name="calendar" size={29} /><span><strong>{name}</strong><small>5 – 31 oct 2026</small></span></div>
    <p className="campaign-label">Tipo de beneficio *</p><div className="campaign-benefit-types">{(["Puntos", "Recompensa"] as const).map((item) => <button className={benefit === item ? "is-active" : ""} key={item} onClick={() => setBenefit(item)}><span className="campaign-round"><RamaxIcon name={item === "Puntos" ? "points" : "rewards"} weight={item === "Puntos" ? "fill" : "regular"} /></span><span><strong>{item}</strong><small>{item === "Puntos" ? "Otorga puntos del club" : "Canje por un producto o experiencia"}</small></span></button>)}</div>
    <label className="demo-field">{benefit === "Puntos" ? "Puntos por participación" : "Valor de la recompensa"} *<input type="number" min="1" value={points} onChange={(event) => setPoints(Number(event.target.value))} /><small>Se acreditan una vez por socio.</small></label>
    <div className="campaign-limit-row"><label className="demo-field">Límite de participantes *<input type="number" min="1" value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></label><label className="campaign-toggle"><input type="checkbox" checked={onePerMember} onChange={(event) => setOnePerMember(event.target.checked)} />Uno por socio</label></div><small className="campaign-limit-help">Máximo de socios que pueden participar en esta campaña.</small>
    <div className="demo-note campaign-preview"><RamaxIcon name="points" size={36} /><span><small>VISTA PREVIA DEL BENEFICIO</small>Cada socio que participe recibe <strong>+{points} puntos.</strong></span></div>
    <div className="campaign-actions"><DemoButton disabled={points < 1 || limit < 1} onClick={() => { setSaved(true); go("listado"); }}>Programar campaña <RamaxIcon name="next" /></DemoButton><DemoButton secondary onClick={() => { setSaved(true); go("listado"); }}>Guardar borrador</DemoButton></div>
  </>;
  else if (screen === "datos") content = <>
    <h1>Ventas</h1><div className="demo-pills campaign-period">{["Hoy · 4 oct", "7 días"].map((item) => <button key={item} className={period === item ? "is-active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div>
    <section className="demo-card campaign-sales-summary"><div><span>Total vendido</span><strong>{period === "7 días" ? "$876.500" : "$145.000"}</strong><b>vendidos</b></div><div><strong>{period === "7 días" ? "84" : "14"}</strong><span>ventas</span><hr /><span>Ticket promedio</span><b>{period === "7 días" ? "$10.435" : "$10.357"}</b></div></section>
    <BarChart title="Ventas por franja" values={period === "7 días" ? [240000, 360000, 276500] : [42000, 55000, 48000]} labels={["Mañana", "Mediodía", "Tarde"]} />
    <section className="demo-chart campaign-payments"><h2>Ventas por medio de pago</h2><div><strong>Efectivo</strong><i><span style={{ width: "55%" }} /></i><b>$80.000<small>55%</small></b></div><div><strong>Transferencia</strong><i><span style={{ width: "45%" }} /></i><b>$65.000<small>45%</small></b></div></section>
    <DemoButton secondary onClick={() => navigate("/ventas")}>Ver ventas del período <RamaxIcon name="next" /></DemoButton>
  </>;
  else if (screen === "resultados") content = <>
    <DemoBack to={route("listado")}>Campañas</DemoBack><h1>Octubre con Ramax</h1><span className="demo-status">Activa</span><p className="campaign-meta"><RamaxIcon name="calendar" />1 – 31 oct 2026</p><p>+50 puntos por participación desde QR del local.</p>
    <div className="campaign-kpis"><div><RamaxIcon name="people" size={32} /><strong>32</strong><span>socios participaron</span></div><div><RamaxIcon name="points" size={32} weight="fill" /><strong>1.600</strong><span>puntos entregados</span></div><div><RamaxIcon name="ticket" size={32} /><strong>78</strong><span>aperturas del QR</span></div></div>
    <BarChart title="Participaciones por día" values={[6, 8, 10, 8]} labels={["1 oct", "2 oct", "3 oct", "4 oct"]} />
    <div className="demo-note"><RamaxIcon name="warning" size={24} />Cada socio recibe el beneficio una sola vez.</div>
    <DemoButton secondary onClick={() => go("beneficio")}>Ver configuración <RamaxIcon name="chevron" /></DemoButton>
  </>;
  else content = <><h1>Pantalla no encontrada</h1><DemoButton onClick={() => go("listado")}>Ver campañas</DemoButton></>;

  return <DemoShell area="campanias" active={active}>{content}</DemoShell>;
}
