import { Link } from "react-router-dom";
import { RamaxBrand, RamaxIcon } from "./brand-ui";
import "../mockup-index.css";

const groups = [
  {
    title: "Administración E0/E1",
    screens: [
      ["01 · Acceso del personal", "/maquetas/admin/acceso"],
      ["02 · Gestión del equipo", "/maquetas/admin/equipo"],
      ["03 · Administración de productos", "/maquetas/admin/productos"],
      ["04 · Ajuste de inventario", "/maquetas/admin/inventario"],
      ["05 · Detalle y anulación de venta", "/maquetas/admin/ventas/248"],
      ["06 · Copias y restauración", "/maquetas/admin/copias"],
    ],
  },
  {
    title: "Equipo · caja y canjes",
    screens: [
      ["01 · Caja", "/maquetas/equipo/caja"],
      ["02 · Productos de venta", "/maquetas/equipo/productos-venta"],
      ["03 · Revisar venta", "/maquetas/equipo/revisar-venta"],
      ["04 · Buscar socio", "/maquetas/equipo/buscar-socio"],
      ["04b · Socio sin conexión", "/maquetas/equipo/socio-sin-conexion"],
      ["05 · Cobrar venta", "/maquetas/equipo/cobrar-venta"],
      ["06 · Venta registrada", "/maquetas/equipo/venta-registrada"],
      ["07 · Historial de ventas", "/maquetas/equipo/ventas"],
      ["08 · Asociación tardía", "/maquetas/equipo/asociar"],
      ["09 · Buscar canje", "/maquetas/equipo/canjes"],
      ["09b · Código inexistente", "/maquetas/equipo/codigo-inexistente"],
      ["09c · Ticket vencido", "/maquetas/equipo/ticket-vencido"],
      ["09d · Ticket cancelado", "/maquetas/equipo/ticket-cancelado"],
      ["09e · Ticket utilizado", "/maquetas/equipo/ticket-utilizado"],
      ["10 · Entregar beneficio", "/maquetas/equipo/entregar"],
      ["10b · Confirmar cancelación", "/maquetas/equipo/cancelar"],
    ],
  },
  {
    title: "Club de socios",
    screens: [
      ["01 · Acceso", "/maquetas/club/acceso"],
      ["02 · Inicio", "/maquetas/club/inicio"],
      ["03 · Beneficios", "/maquetas/club/beneficios"],
      ["04 · Detalle del beneficio", "/maquetas/club/detalle"],
      ["05 · Confirmar canje", "/maquetas/club/confirmar"],
      ["06 · Ticket de canje", "/maquetas/club/ticket"],
      ["06b · Confirmar cancelación", "/maquetas/club/cancelar"],
      ["07 · Mis canjes", "/maquetas/club/canjes"],
      ["08 · Movimientos", "/maquetas/club/movimientos"],
      ["08b · Saldo negativo", "/maquetas/club/saldo-negativo"],
      ["09 · Mis compras", "/maquetas/club/compras"],
      ["10 · Mi cuenta", "/maquetas/club/cuenta"],
    ],
  },
  {
    title: "Campañas futuras",
    screens: [
      ["11 · Campañas", "/maquetas/campanias/listado"],
      ["12 · Nueva campaña", "/maquetas/campanias/nueva"],
      ["13 · Beneficio de campaña", "/maquetas/campanias/beneficio"],
      ["14 · Datos de ventas", "/maquetas/campanias/datos"],
      ["15 · Resultados", "/maquetas/campanias/resultados"],
    ],
  },
] as const;

export function MockupIndex() {
  return <main className="mockup-index"><header><RamaxBrand original /><span>39 PANTALLAS</span></header><div className="mockup-index__intro"><p>RAMAX · Revisión visual</p><h1>Maquetas interactivas</h1><p>Elegí una pantalla o recorré los flujos. Los datos de estas rutas son ejemplos locales.</p></div><div className="mockup-index__groups">{groups.map((group) => <section key={group.title}><h2>{group.title}</h2><div>{group.screens.map(([label, route]) => <Link key={route} to={route}><span>{label}</span><RamaxIcon name="next" size={19} /></Link>)}</div></section>)}</div></main>;
}
