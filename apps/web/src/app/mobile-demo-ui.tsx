import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { RamaxIcon, type RamaxIconName } from "./brand-ui";
import "../mobile-demo.css";

export type DemoArea = "equipo" | "campanias";

export function DemoShell({ area, active, offline = false, children }: { area: DemoArea; active: "caja" | "ventas" | "canjes" | "campanias" | "datos"; offline?: boolean; children: ReactNode }) {
  const admin = area === "campanias";
  const base = admin ? "/maquetas/campanias" : "/maquetas/equipo";
  const items: { label: string; icon: RamaxIconName; href: string; id: typeof active }[] = admin
    ? [{ label: "Caja", icon: "register", href: "/maquetas/equipo/caja", id: "caja" }, { label: "Campañas", icon: "campaign", href: `${base}/listado`, id: "campanias" }, { label: "Datos", icon: "sales", href: `${base}/datos`, id: "datos" }]
    : [{ label: "Caja", icon: "register", href: `${base}/caja`, id: "caja" }, { label: "Ventas", icon: "sales", href: `${base}/ventas`, id: "ventas" }, { label: "Canjes", icon: "rewards", href: `${base}/canjes`, id: "canjes" }];
  return <div className={"demo-mobile demo-mobile--" + area}>
    <header className="demo-mobile__header">
      <div className="demo-mobile__brand"><img src="/assets/ramax-emblem.png" alt="" /><span><strong>RAMAX</strong><small>{admin ? "ADMIN" : "CAJA"}</small></span></div>
      <div className="demo-mobile__person"><strong>{admin ? "Sofía" : "Lucía"}</strong><span>{admin ? "ADMINISTRADOR" : "SAN LUIS"}</span><small><i className={offline ? "is-offline" : ""} />{offline ? "Sin internet" : "En línea"}</small></div>
    </header>
    <main className="demo-mobile__body">{children}</main>
    <nav className="demo-mobile__bottom" aria-label="Navegación de la maqueta">{items.map((item) => <Link key={item.label} className={active === item.id ? "is-active" : ""} to={item.href}><RamaxIcon name={item.icon} size={31} weight={active === item.id ? "fill" : "regular"} />{item.label}</Link>)}</nav>
  </div>;
}

export function DemoBack({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="demo-back" to={to}><RamaxIcon name="back" size={23} />{children}</Link>;
}

export function DemoButton({ children, onClick, secondary = false, disabled = false }: { children: ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button className={secondary ? "demo-button demo-button--secondary" : "demo-button"} type="button" onClick={onClick} disabled={disabled}>{children}</button>;
}
