import { useStaff } from "./staff-context";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@ramax/contracts";
import {
  createBrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  useLoaderData,
  useNavigate,
  useLocation,
  useRouteError,
} from "react-router-dom";
import { apiRequest, getSession, staffLogin } from "./session";
import { demoSession } from "./demo-api";
import { Notice } from "./ui";
import { RamaxBrand, RamaxIcon, type RamaxIconName } from "./brand-ui";
function ErrorScreen() {
  const error = useRouteError();
  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Servidor local no disponible</h1>
        <p role="alert">
          {error instanceof Error
            ? error.message
            : "Revisá la conexión con la PC administrativa."}
        </p>
        <button onClick={() => location.reload()}>Reintentar</button>
      </section>
    </main>
  );
}
function Connectivity({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState("Comprobando servidor local…");
  useEffect(() => {
    let alive = true;
    const check = () => {
      void apiRequest<{ internet: boolean | null }>("/health")
        .then((data) => {
          if (alive)
            setStatus(
              data.internet === false
                ? "Servidor local disponible · Sin internet"
                : data.internet === true
                  ? "Servidor local disponible · Internet disponible"
                  : "Servidor local disponible · Internet sin verificar",
            );
        })
        .catch(() => {
          if (alive) setStatus("Servidor local no disponible");
        });
    };
    check();
    const timer = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return <small className={status.includes("Internet disponible") ? "connection-online" : "connection-pending"} role="status" title={status}>{compact && <RamaxIcon name="connection" size={10} weight="fill" />} {compact ? (status.includes("Comprobando") ? "Comprobando…" : status.includes("Sin internet") ? "Sin internet" : status.includes("Internet disponible") ? "En línea" : status.includes("no disponible") ? "Sin conexión local" : "Internet sin verificar") : status}</small>;
}
function Layout({ demo = false }: { demo?: boolean }) {
  const session = useLoaderData() as Session;
  const { pathname } = useLocation();
  const sales = pathname === "/operacion" || pathname.startsWith("/ventas");
  const base = demo ? "/maquetas/admin" : "";
  if (!session.authenticated) return <Navigate to="/login" replace />;
  const admin = session.user.primaryRole === "admin";
  return (
    <div className={`local-layout${sales ? " sales-shell" : ""}`}>
      <aside className="local-sidebar">
        <RamaxBrand original />
        <nav aria-label="Navegación principal">
          {[
            ["/operacion", "Caja", sales ? "register" : "home"],
            ["/ventas", "Ventas", "sales"],
            ["/productos", "Productos", "products"],
            ["/inventario", "Inventario", "products"],
            ...(admin
              ? [
                  ["/equipo", "Equipo", "people"],
                  ...(!demo ? [["/club-admin", "Club Ramax", "people"]] : []),
                  ["/copias", "Copias de seguridad", "backups"],
                ]
              : []),
          ].map(([to, title, icon]) => (
            <NavLink key={to} to={base + to!}>
              <RamaxIcon name={icon as RamaxIconName} size={20} weight="light" />
              <span>{title}</span>
            </NavLink>
          ))}
          {sales && <details className="sales-mobile-menu"><summary><RamaxIcon name="menu" size={28} weight="light" /><span>Más</span></summary><div>
            <NavLink to="/productos">Productos</NavLink>
            <NavLink to="/inventario">Inventario</NavLink>
            {admin && <><NavLink to="/equipo">Equipo</NavLink>{!demo && <NavLink to="/club-admin">Club Ramax</NavLink>}<NavLink to="/copias">Copias de seguridad</NavLink></>}
            <button onClick={() => { void apiRequest("/auth/logout", { method: "POST" }).then(() => location.assign("/login")); }}>Cerrar sesión</button>
          </div></details>}
        </nav>
        <div className="staff-info">
          {session.user.displayName}
          <small className="staff-role">{admin ? "Administrador" : "Empleado"}</small>
          {sales && <div className="sales-staff-status"><span>SAN LUIS</span><Connectivity compact /></div>}
          <button
            onClick={() => {
              if (demo) { location.assign("/maquetas/admin/acceso"); return; }
              void apiRequest("/auth/logout", { method: "POST" }).then(() =>
                location.assign("/login"),
              );
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="local-content">
        <header className={`local-status${sales ? " sales-desktop-status" : ""}`}>
          <span>San Luis</span>
          <Connectivity />
        </header>
        <Outlet context={session} />
      </main>
    </div>
  );
}
function AdminOnly({ children }: { children: React.ReactNode }) {
  const session = useStaff();
  return session.user.primaryRole === "admin" ? (
    children
  ) : (
    <Navigate to="/operacion" replace />
  );
}
function Login({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      await staffLogin(
        String(form.get("username")),
        String(form.get("password")),
      );
      navigate(demo ? "/maquetas/admin/equipo" : "/operacion");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="staff-login-page">
      <section className="login-intro">
        <RamaxBrand original />
        <p className="login-intro__motto">CAFÉ · COMIDA · PERSONAS · MOMENTOS</p>
        <h1>Buenos cafés,<br />mejores días</h1>
        <p className="login-intro__caption">SISTEMA DE ADMINISTRACIÓN LOCAL</p>
        <p>Empleado y Administrador</p>
      </section>
      <form className="panel staff-login-card" onSubmit={submit}>
        <h2>Acceso del equipo</h2>
        <p>Ingresá para continuar con la administración de Ramax Café &amp; Lunch.</p>
        <div className="staff-login-card__fields">
        <label>
          Usuario
          <span className="staff-login-card__input"><RamaxIcon name="account" size={25} /><input name="username" autoComplete="username" required /></span>
        </label>
        <label>
          Contraseña
          <span className="staff-login-card__input"><RamaxIcon name="hidden" size={25} /><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" minLength={8} required /><button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((value) => !value)}><RamaxIcon name={showPassword ? "hidden" : "visible"} size={22} /></button></span>
        </label>
        </div>
        <Notice error={error} />
        <button className="button button--primary" disabled={busy}>
          {busy ? "Ingresando…" : <>Ingresar <RamaxIcon name="next" size={25} /></>}
        </button>
        <p className="staff-login-card__help"><strong>¿Olvidaste tu contraseña?</strong><br />Pedile al administrador que la restablezca.</p>
        <div className="staff-login-card__status"><RamaxIcon name="location" size={19} /><strong>San Luis</strong><span>·</span><Connectivity /></div>
      </form>
    </main>
  );
}
export const router = createBrowserRouter([
  { path: "/maquetas", lazy: async () => ({ Component: (await import("./mockup-index")).MockupIndex }) },
  { path: "/maquetas/admin/acceso", element: <Login demo /> },
  {
    path: "/maquetas/admin",
    loader: async () => demoSession,
    element: <Layout demo />,
    children: [
      { index: true, element: <Navigate to="equipo" replace /> },
      { path: "equipo", lazy: async () => ({ Component: (await import("./staff-screen")).StaffScreen }) },
      { path: "productos", lazy: async () => ({ Component: (await import("./product-admin-screen")).ProductsScreen }) },
      { path: "inventario", lazy: async () => ({ Component: (await import("./inventory-admin-screen")).InventoryScreen }) },
      { path: "copias", lazy: async () => ({ Component: (await import("./backups-admin-screen")).BackupsScreen }) },
      { path: "ventas", lazy: async () => ({ Component: (await import("./sales-screen")).SalesScreen }) },
      { path: "ventas/:id", lazy: async () => ({ Component: (await import("./sales-screen")).SaleDetailScreen }) },
      { path: "operacion", lazy: async () => ({ Component: (await import("./sale-screen")).SaleScreen }) },
    ],
  },
  { path: "/maquetas/club/*", lazy: async () => ({ Component: (await import("./club-demo")).ClubDemo }) },
  { path: "/maquetas/campanias/*", lazy: async () => ({ Component: (await import("./campaign-demo")).CampaignDemo }) },
  { path: "/maquetas/equipo/*", lazy: async () => ({ Component: (await import("./team-demo")).TeamDemo }) },
  { path: "/club/*", lazy: async () => ({ Component: (await import("./club-live")).ClubLive }) },
  { path: "/login", element: <Login /> },
  { path: "/login/personal", element: <Navigate to="/login" replace /> },
  {
    path: "/",
    loader: getSession,
    element: <Layout />,
    errorElement: <ErrorScreen />,
    children: [
      { index: true, element: <Navigate to="/operacion" replace /> },
      { path: "operacion", lazy: async () => ({ Component: (await import("./sale-screen")).SaleScreen }) },
      {
        path: "operacion/ventas/nueva",
        element: <Navigate to="/operacion" replace />,
      },
      { path: "ventas", lazy: async () => ({ Component: (await import("./sales-screen")).SalesScreen }) },
      { path: "ventas/:id", lazy: async () => ({ Component: (await import("./sales-screen")).SaleDetailScreen }) },
      { path: "productos", lazy: async () => ({ Component: (await import("./product-admin-screen")).ProductsScreen }) },
      { path: "inventario", lazy: async () => ({ Component: (await import("./inventory-admin-screen")).InventoryScreen }) },
      {
        path: "equipo",
        lazy: async () => {
          const { StaffScreen } = await import("./staff-screen");
          return { Component: () => <AdminOnly><StaffScreen /></AdminOnly> };
        },
      },
      {
        path: "club-admin",
        lazy: async () => {
          const { ClubAdminScreen } = await import("./club-admin-screen");
          return { Component: () => <AdminOnly><ClubAdminScreen /></AdminOnly> };
        },
      },
      {
        path: "copias",
        lazy: async () => {
          const { BackupsScreen } = await import("./backups-admin-screen");
          return { Component: () => <AdminOnly><BackupsScreen /></AdminOnly> };
        },
      },
      { path: "admin", element: <Navigate to="/productos" replace /> },
      {
        path: "admin/productos",
        element: <Navigate to="/productos" replace />,
      },
      { path: "*", element: <Navigate to="/operacion" replace /> },
    ],
  },
]);
