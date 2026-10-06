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
import { SaleScreen } from "./sale-screen";
import { ProductsScreen } from "./products-screen";
import { InventoryScreen, StaffScreen } from "./staff-inventory";
import { SalesScreen, SaleDetailScreen } from "./sales-screen";
import { BackupsScreen } from "./backups-screen";
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
function Layout() {
  const session = useLoaderData() as Session;
  const { pathname } = useLocation();
  const sales = pathname === "/operacion" || pathname.startsWith("/ventas");
  if (!session.authenticated) return <Navigate to="/login" replace />;
  const admin = session.user.primaryRole === "admin";
  return (
    <div className={`local-layout${sales ? " sales-shell" : ""}`}>
      <aside className="local-sidebar">
        <RamaxBrand original={sales} />
        <nav aria-label="Navegación principal">
          {[
            ["/operacion", "Caja", sales ? "register" : "home"],
            ["/ventas", "Ventas", "sales"],
            ["/productos", "Productos", "products"],
            ["/inventario", "Inventario", "products"],
            ...(admin
              ? [
                  ["/equipo", "Equipo", "people"],
                  ["/copias", "Copias de seguridad", "backups"],
                ]
              : []),
          ].map(([to, title, icon]) => (
            <NavLink key={to} to={to!}>
              <RamaxIcon name={icon as RamaxIconName} size={20} weight="light" />
              <span>{title}</span>
            </NavLink>
          ))}
          {sales && <details className="sales-mobile-menu"><summary><RamaxIcon name="menu" size={28} weight="light" /><span>Más</span></summary><div>
            <NavLink to="/productos">Productos</NavLink>
            <NavLink to="/inventario">Inventario</NavLink>
            {admin && <><NavLink to="/equipo">Equipo</NavLink><NavLink to="/copias">Copias de seguridad</NavLink></>}
            <button onClick={() => { void apiRequest("/auth/logout", { method: "POST" }).then(() => location.assign("/login")); }}>Cerrar sesión</button>
          </div></details>}
        </nav>
        <div className="staff-info">
          {session.user.displayName}
          <small className="staff-role">{admin ? "Administrador" : "Empleado"}</small>
          {sales && <div className="sales-staff-status"><span>SAN LUIS</span><Connectivity compact /></div>}
          <button
            onClick={() => {
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
function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
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
      navigate("/operacion");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="staff-login-page">
      <section className="login-intro">
        <RamaxBrand />
        <h1>Bienvenido al equipo.</h1>
        <p>La operación del local, en un solo lugar.</p>
      </section>
      <form className="panel" onSubmit={submit}>
        <h2>Acceso del equipo</h2>
        <label>
          Usuario
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>
        <Notice error={error} />
        <button className="button button--primary" disabled={busy}>
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
        <p>
          ¿Olvidaste tu contraseña? Pedile al administrador que la restablezca.
        </p>
      </form>
    </main>
  );
}
export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/login/personal", element: <Navigate to="/login" replace /> },
  {
    path: "/",
    loader: getSession,
    element: <Layout />,
    errorElement: <ErrorScreen />,
    children: [
      { index: true, element: <Navigate to="/operacion" replace /> },
      { path: "operacion", element: <SaleScreen /> },
      {
        path: "operacion/ventas/nueva",
        element: <Navigate to="/operacion" replace />,
      },
      { path: "ventas", element: <SalesScreen /> },
      { path: "ventas/:id", element: <SaleDetailScreen /> },
      { path: "productos", element: <ProductsScreen /> },
      { path: "inventario", element: <InventoryScreen /> },
      {
        path: "equipo",
        element: (
          <AdminOnly>
            <StaffScreen />
          </AdminOnly>
        ),
      },
      {
        path: "copias",
        element: (
          <AdminOnly>
            <BackupsScreen />
          </AdminOnly>
        ),
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
