import { useState, type FormEvent } from "react";
import type { AppRole, Session } from "@ramax/contracts";
import { Link, NavLink, Navigate, createBrowserRouter, useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { getSession, googleLoginUrl, staffLogin } from "./session.ts";
import { SaleScreen } from "./sale-screen.tsx";
import { ProductsScreen } from "./products-screen.tsx";

type Area = "club" | "operacion" | "admin";

function BrandLockup({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand-lockup${inverse ? " brand-lockup--inverse" : ""}`} aria-label="Ramax Coffee & Lunch">
      <span className="brand-lockup__name">RAMAX</span>
      <span className="brand-lockup__subtitle">COFFEE & LUNCH</span>
    </span>
  );
}

function AppLayout({ children, area }: { children: React.ReactNode; area: Area }) {
  const homePath = area === "club" ? "/club" : area === "operacion" ? "/operacion" : "/admin";
  const areaLabel = area === "club" ? "MI CLUB" : area === "operacion" ? "CAJA" : "ADMIN";
  return (
    <main className={`app-shell app-shell--${area}`}>
      <header className="app-header">
        <Link className="brand-link" to={homePath}>
          <BrandLockup inverse />
        </Link>
        <span className="area-badge">{areaLabel}</span>
      </header>
      <section className="app-content">{children}</section>
      <nav className="bottom-nav" aria-label="Navegación principal">
        <NavLink to={homePath} className={({ isActive }) => (isActive ? "is-active" : undefined)}>
          <span aria-hidden="true">{area === "club" ? "⌂" : area === "operacion" ? "⊞" : "☷"}</span>
          {area === "club" ? "Club" : area === "operacion" ? "Caja" : "Admin"}
        </NavLink>
      </nav>
    </main>
  );
}

function Home() {
  const session = useLoaderData() as Session;
  return session.authenticated ? <Navigate replace to={session.homePath} /> : <Navigate replace to="/login" />;
}

function Login() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <BrandLockup inverse />
        <p className="eyebrow">BIENVENIDO AL CLUB</p>
        <h1 id="login-title">Tu cafe.<br />Tus puntos.</h1>
        <p className="login-copy">Entrá, acumulá puntos en cada visita y canjealos por lo que más te gusta de Ramax.</p>
        <a className="button button--primary" href={googleLoginUrl()}>
          Continuar con Google <span aria-hidden="true">→</span>
        </a>
        <Link className="staff-login-link" to="/login/personal">Acceso para el equipo</Link>
        <p className="login-note">Al continuar aceptás los términos del Club Ramax.</p>
      </section>
    </main>
  );
}

function StaffLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError(undefined);
    try {
      const session = await staffLogin(String(form.get("email")), String(form.get("password")));
      navigate(session.homePath, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="staff-login-title">
        <BrandLockup inverse />
        <p className="eyebrow">EQUIPO RAMAX</p>
        <h1 id="staff-login-title">Abrí tu turno.</h1>
        <form className="staff-login-form" onSubmit={submit}>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Contraseña<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button--primary" disabled={loading} type="submit">
            {loading ? "Ingresando..." : "Ingresar"} <span aria-hidden="true">→</span>
          </button>
        </form>
        <Link className="staff-login-link" to="/login">Volver al acceso de socios</Link>
      </section>
    </main>
  );
}

function ClubHome({ displayName }: { displayName: string }) {
  const firstName = displayName.split(" ")[0] || "socio";

  return (
    <>
      <section className="club-intro" aria-labelledby="club-title">
        <p className="eyebrow">HOLA, {firstName.toUpperCase()}</p>
        <h1 id="club-title">Tu club Ramax</h1>
      </section>

      <section className="points-card" aria-labelledby="points-title">
        <p className="eyebrow eyebrow--inverse">SALDO DISPONIBLE</p>
        <p id="points-title" className="points-card__number">-- <span>puntos</span></p>
        <p className="points-card__copy">Tu saldo aparecerá luego de tu primera compra asociada al Club.</p>
        <div className="progress-track" aria-label="Progreso hacia tu próximo premio, aún sin datos"><span /></div>
      </section>

      <Link className="button button--primary button--block" to="/club/qr">
        Mostrar mi QR <span aria-hidden="true">▣</span>
      </Link>

      <section className="content-section" aria-labelledby="benefits-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PARA VOS</p>
            <h2 id="benefits-title">Beneficios</h2>
          </div>
          <Link to="/club/beneficios">Ver todos</Link>
        </div>
        <article className="benefit-card">
          <span className="label-chip">PRÓXIMAMENTE</span>
          <h3>Tu próximo premio va a aparecer acá.</h3>
          <p>Comprá en Ramax y mostrá tu QR para empezar a sumar.</p>
        </article>
      </section>
    </>
  );
}

function QrScreen() {
  return (
    <section className="qr-screen" aria-labelledby="qr-title">
      <Link className="back-link" to="/club">← Volver al Club</Link>
      <p className="eyebrow">IDENTIFICACIÓN DE SOCIO</p>
      <h1 id="qr-title">Mi código Ramax</h1>
      <p className="area-copy">Mostralo en caja para asociar tu compra al Club.</p>
      <div className="qr-card">
        <div className="qr-placeholder" aria-label="El QR aparecerá cuando se conecte al servicio de membresías">
          <span>RAMAX</span>
        </div>
        <p className="qr-card__id">TU CÓDIGO VA A APARECER ACÁ</p>
      </div>
      <p className="helper-text">Todavía no hay un código disponible para esta cuenta.</p>
    </section>
  );
}

function BenefitsScreen() {
  return (
    <section aria-labelledby="rewards-title">
      <Link className="back-link" to="/club">← Volver al Club</Link>
      <p className="eyebrow">CATÁLOGO</p>
      <h1 id="rewards-title">Beneficios</h1>
      <div className="filter-row" aria-label="Filtros de beneficios">
        <button className="filter-chip is-selected" type="button">Todos</button>
        <button className="filter-chip" type="button">Café</button>
        <button className="filter-chip" type="button">Comida</button>
      </div>
      <article className="reward-empty">
        <span className="label-chip">PRÓXIMAMENTE</span>
        <h2>El catálogo de premios todavía está vacío.</h2>
        <p>Cuando Ramax publique sus recompensas, las vas a encontrar en esta pantalla.</p>
      </article>
    </section>
  );
}

function ClubArea({ displayName }: { displayName: string }) {
  const { pathname } = useLocation();

  if (pathname.endsWith("/qr")) return <QrScreen />;
  if (pathname.endsWith("/beneficios")) return <BenefitsScreen />;
  return <ClubHome displayName={displayName} />;
}

function WorkArea({ area }: { area: Exclude<Area, "club"> }) {
  const { pathname } = useLocation();
  const isOperations = area === "operacion";
  const title = isOperations ? "Caja Ramax" : "Administración";
  const description = isOperations
    ? "Registrá una venta y asociá al socio cuando corresponda."
    : "Gestioná el catálogo, las recompensas y las reglas del Club.";

  if (isOperations && pathname.endsWith("/ventas/nueva")) return <SaleScreen />;
  if (!isOperations && pathname.endsWith("/productos")) return <ProductsScreen />;

  return (
    <>
      <section className="club-intro" aria-labelledby="area-title">
        <p className="eyebrow">{isOperations ? "OPERACIÓN DEL LOCAL" : "CONFIGURACIÓN"}</p>
        <h1 id="area-title">{title}</h1>
        <p className="area-copy">{description}</p>
      </section>
      <section className="action-grid" aria-label={`Acciones de ${title}`}>
        {isOperations ? (
          <>
            <Link className="action-tile action-tile--coral" to="/operacion/ventas/nueva"><span>＋</span>Nueva venta</Link>
            <button className="action-tile" type="button"><span>⌕</span>Buscar socio</button>
            <button className="action-tile" type="button"><span>✓</span>Validar canje</button>
            <button className="action-tile" type="button"><span>▤</span>Ver stock</button>
          </>
        ) : (
          <>
            <button className="action-tile action-tile--coral" type="button"><span>✦</span>Crear campaña</button>
            <button className="action-tile" type="button"><span>□</span>Recompensas</button>
            <Link className="action-tile" to="/admin/productos"><span>▤</span>Productos</Link>
            <button className="action-tile" type="button"><span>◌</span>Regla de puntos</button>
          </>
        )}
      </section>
      <section className="empty-panel">
        <p className="eyebrow">SIN ACTIVIDAD AÚN</p>
        <h2>{isOperations ? "Todo listo para abrir caja." : "El panel va a crecer por módulos."}</h2>
        <p>Esta sección conserva el nuevo lenguaje visual mientras se conectan los flujos del MVP.</p>
      </section>
    </>
  );
}

function ProtectedArea({ allowedRoles, area }: { allowedRoles: AppRole[]; area: Area }) {
  const session = useLoaderData() as Session;

  if (!session.authenticated) {
    return <Navigate replace to="/login" />;
  }

  if (!session.user.roles.some((role) => allowedRoles.includes(role))) {
    return <Navigate replace to={session.homePath} />;
  }

  return <AppLayout area={area}>{area === "club" ? <ClubArea displayName={session.user.displayName} /> : <WorkArea area={area} />}</AppLayout>;
}

export const router = createBrowserRouter([
  { path: "/", loader: getSession, element: <Home /> },
  { path: "/login", element: <Login /> },
  { path: "/login/personal", element: <StaffLogin /> },
  { path: "/auth/complete", loader: getSession, element: <Home /> },
  {
    path: "/club/*",
    loader: getSession,
    element: <ProtectedArea allowedRoles={["member"]} area="club" />,
  },
  {
    path: "/operacion/*",
    loader: getSession,
    element: <ProtectedArea allowedRoles={["employee", "admin"]} area="operacion" />,
  },
  {
    path: "/admin/*",
    loader: getSession,
    element: <ProtectedArea allowedRoles={["admin"]} area="admin" />,
  },
]);
