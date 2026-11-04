import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ClubMemberProfile, PointAccount } from "@ramax/contracts";
import { RamaxBrand, RamaxIcon } from "./brand-ui";
import {
  clubLogout,
  clubAuthMethods,
  clubPoints,
  clubPurchases,
  clubSession,
  googleLogin,
  pilotLogin,
  saveClubPhone,
  type ClubPurchase,
} from "./cloud-session";
import { salesDate, salesMoney } from "./sales-format";
import "../club-demo.css";
import "../club-live.css";

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, string | number>): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const root = "/club";
const path = (screen: string) => `${root}/${screen}`;

function GoogleAccess({ onLogin, pilotAvailable }: { onLogin: (member: ClubMemberProfile) => void; pilotAvailable?: boolean }) {
  const target = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !target.current) return;
    let alive = true;
    const render = () => {
      if (!alive || !target.current || !window.google) return;
      target.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          void googleLogin(credential)
            .then(({ member }) => { if (alive) onLogin(member); })
            .catch((reason: Error) => { if (alive) setError(reason.message); });
        },
      });
      window.google.accounts.id.renderButton(target.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: 300,
        locale: "es",
      });
    };
    if (window.google) render();
    else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = render;
      script.onerror = () => { if (alive) setError("No pudimos cargar el acceso con Google."); };
      document.head.append(script);
    }
    return () => { alive = false; };
  }, [clientId, onLogin]);

  return <div className="club-google">
    {clientId ? <div ref={target} aria-label="Continuar con Google" /> : pilotAvailable === false && <p role="alert">El acceso al club aún no está configurado.</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

function PilotAccess({ onLogin }: { onLogin: (member: ClubMemberProfile) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { member } = await pilotLogin(code);
      onLogin(member);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <form className="club-pilot-access" onSubmit={(event) => void submit(event)}>
    <label>Código de acceso de prueba<input type="password" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" required /></label>
    <button className="club-button" type="submit" disabled={busy}>{busy ? "Ingresando…" : "Entrar como socio de prueba"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function ClubHeader({ member }: { member: ClubMemberProfile }) {
  return <header className="club-header"><RamaxBrand original /><div className="club-header__member"><span>Socio</span><strong>{member.memberNumber}</strong></div></header>;
}

function ClubBottom({ active }: { active: "inicio" | "beneficios" | "cuenta" }) {
  return <nav className="club-bottom" aria-label="Navegación del club">
    <Link className={active === "inicio" ? "is-active" : ""} to={path("inicio")}><RamaxIcon name="home" size={30} weight={active === "inicio" ? "fill" : "light"} />Inicio</Link>
    <Link className={active === "beneficios" ? "is-active" : ""} to={path("beneficios")}><RamaxIcon name="points" size={31} weight={active === "beneficios" ? "fill" : "light"} />Beneficios</Link>
    <Link className={active === "cuenta" ? "is-active" : ""} to={path("cuenta")}><RamaxIcon name="account" size={31} weight={active === "cuenta" ? "fill" : "light"} />Mi cuenta</Link>
  </nav>;
}

function PointsBadge() {
  return <span className="club-star"><RamaxIcon name="points" size={38} weight="fill" /></span>;
}

function movementTitle(kind: string): string {
  switch (kind) {
    case "sale_credit": return "Puntos por compra";
    case "sale_reversal": return "Anulación de compra";
    case "expiry": return "Vencimiento de puntos";
    case "adjustment": return "Ajuste de puntos";
    default: return "Movimiento de puntos";
  }
}

export function ClubLive() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const screen = pathname.slice(root.length + 1) || "inicio";
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<ClubMemberProfile>();
  const [pilotAvailable, setPilotAvailable] = useState<boolean>();
  const [points, setPoints] = useState<PointAccount>();
  const [purchases, setPurchases] = useState<ClubPurchase[]>([]);
  const [pointsPage, setPointsPage] = useState(1);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [purchasesHasMore, setPurchasesHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedPurchase, setExpandedPurchase] = useState<string>();

  useEffect(() => {
    let alive = true;
    void clubAuthMethods()
      .then((methods) => { if (alive) setPilotAvailable(methods.pilot); })
      .catch(() => { if (alive) setPilotAvailable(false); });
    void clubSession()
      .then((session) => {
        if (!alive) return;
        if (session.authenticated) {
          setMember(session.member);
          setPhone(session.member.phone ?? "");
        }
      })
      .catch((reason: Error) => { if (alive) setError(reason.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!member) return;
    let alive = true;
    void Promise.all([clubPoints(), clubPurchases()])
      .then(([account, sales]) => {
        if (alive) {
          setPoints(account);
          setPointsPage(1);
          setPurchases(sales.items);
          setPurchasesHasMore(sales.hasMore);
          setPurchasesPage(1);
        }
      })
      .catch((reason: Error) => { if (alive) setError(reason.message); });
    return () => { alive = false; };
  }, [member?.id]);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  function loggedIn(profile: ClubMemberProfile) {
    setMember(profile);
    setPhone(profile.phone ?? "");
    setError(undefined);
    navigate(path("inicio"));
  }

  async function updatePhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      setMember(await saveClubPhone(phone));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setError(undefined);
    try {
      await clubLogout();
      setMember(undefined);
      setPoints(undefined);
      setPurchases([]);
      navigate(path("acceso"));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function loadMorePoints() {
    setLoadingMore(true);
    setError(undefined);
    try {
      const next = await clubPoints(pointsPage + 1);
      setPoints((current) => current ? { ...next, movements: [...current.movements, ...next.movements] } : next);
      setPointsPage((page) => page + 1);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadMorePurchases() {
    setLoadingMore(true);
    setError(undefined);
    try {
      const next = await clubPurchases(purchasesPage + 1);
      setPurchases((current) => [...current, ...next.items]);
      setPurchasesHasMore(next.hasMore);
      setPurchasesPage((page) => page + 1);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) return <main className="club-demo club-live-loading" role="status">Cargando el club…</main>;
  if (!member) {
    if (screen !== "acceso") return <Navigate to={path("acceso")} replace />;
    return <main className="club-demo club-access"><div className="club-access__top"><RamaxBrand original /><h1>Más que café,<br />buenos momentos</h1><p>Entrá al club para ver tus puntos y tus compras.</p><GoogleAccess onLogin={loggedIn} pilotAvailable={pilotAvailable} />{pilotAvailable && <PilotAccess onLogin={loggedIn} />}<small>Tu membresía se crea automáticamente<br />en tu primer acceso.</small>{error && <p role="alert">{error}</p>}</div><img src="/assets/club-ramax-scene.png" alt="Café Ramax" /></main>;
  }

  if (screen === "acceso") return <Navigate to={path("inicio")} replace />;
  const balance = points?.confirmedBalance ?? 0;
  const active = screen === "beneficios" ? "beneficios" : ["cuenta", "compras"].includes(screen) ? "cuenta" : "inicio";
  let content: React.ReactNode;

  if (screen === "inicio") content = <>
    <h1 className="club-greeting">Hola, {member.displayName?.split(" ")[0] ?? "Socio"}</h1>
    <section className="club-points-card"><div><PointsBadge /><p><strong className={balance < 0 ? "is-negative" : ""}>{balance}</strong><span>puntos</span><small>Saldo confirmado</small></p></div><p>{balance < 0 ? "Una anulación puede dejar el saldo negativo. Las próximas compras sumarán puntos." : "Tus compras suman puntos cuando se confirman en el club."}</p></section>
    <Link className="club-button" to={path("movimientos")}>Ver mis puntos <RamaxIcon name="next" /></Link>
    <Link className="club-feature" to={path("compras")}><img src="/assets/club-ramax-scene.png" alt="" /><strong>Mis<br />compras</strong><span>Ver historial</span></Link>
    <Link className="club-text-link" to={path("compras")}>Ver compras <RamaxIcon name="next" size={21} /></Link>
  </>;
  else if (screen === "movimientos") content = <>
    <Link className="club-back" to={path("inicio")}><RamaxIcon name="back" />Volver</Link><h1>Tus puntos</h1>
    <section className="club-points-card club-points-card--history"><div><PointsBadge /><p><strong className={balance < 0 ? "is-negative" : ""}>{balance}</strong><span>puntos</span></p></div><small>Saldo confirmado</small>{balance < 0 && <p>Tu saldo puede ser negativo después de anular una compra. Podés seguir sumando puntos.</p>}</section>
    <div className="club-segments"><button className="is-active">Movimientos</button><Link to={path("compras")}>Compras</Link></div>
    <section className="club-movements">{points?.movements.length ? points.movements.map((movement) => <div className="club-movement" key={movement.id}><small>{salesDate(movement.createdAt)}</small><div><span className="club-movement__icon"><RamaxIcon name={movement.delta > 0 ? "cart" : "points"} /></span><p><strong>{movementTitle(movement.kind)}</strong><span>{movement.description}</span></p><b className={movement.delta < 0 ? "is-negative" : ""}>{movement.delta > 0 ? "+" : ""}{movement.delta}<small>puntos</small></b></div></div>) : <p>Todavía no hay movimientos confirmados.</p>}{points?.hasMore && <button className="club-button" type="button" disabled={loadingMore} onClick={() => void loadMorePoints()}>{loadingMore ? "Cargando…" : "Ver más movimientos"}</button>}</section>
  </>;
  else if (screen === "compras") content = <>
    <h1>Mis compras</h1><p className="club-lead">Solo aparecen las ventas sincronizadas con el club.</p>
    <section className="club-purchases">{purchases.length ? purchases.map((purchase) => <button type="button" className={`club-purchase${expandedPurchase === purchase.saleId ? " is-expanded" : ""}`} key={purchase.saleId} onClick={() => setExpandedPurchase(expandedPurchase === purchase.saleId ? undefined : purchase.saleId)}><span><strong>Compra N.º {purchase.saleNumber}</strong><b>{salesMoney(purchase.totalArs)}</b></span><small>{salesDate(purchase.closedAt)} · {purchase.status === "void" ? "Anulada" : `+${purchase.pointsEarned} puntos`}</small>{expandedPurchase === purchase.saleId && <div className="club-purchase__detail">{purchase.items.map((item, index) => <p key={index}>{item.quantity} × {item.productName}<span>{salesMoney(item.subtotalArs)}</span></p>)}<p><strong>Total</strong><strong>{salesMoney(purchase.totalArs)}</strong></p><p>{purchase.status === "void" ? "Puntos revertidos" : "Puntos acreditados"}<strong>{purchase.status === "void" ? `−${purchase.pointsEarned}` : `+${purchase.pointsEarned}`} puntos</strong></p></div>}</button>) : <p>Todavía no hay compras sincronizadas.</p>}{purchasesHasMore && <button className="club-button" type="button" disabled={loadingMore} onClick={() => void loadMorePurchases()}>{loadingMore ? "Cargando…" : "Ver más compras"}</button>}</section>
  </>;
  else if (screen === "cuenta") content = <>
    <h1>Mi cuenta</h1><p className="club-lead">Hola, {member.displayName}</p>
    <section className="club-member-card"><span>SOCIO</span><strong>{member.memberNumber}</strong><div>★</div><p>Mostrá este número en caja<br />para sumar puntos.</p></section>
    <div className="club-account-links"><Link to={path("compras")}><RamaxIcon name="cart" />Mis compras<RamaxIcon name="chevron" /></Link><Link to={path("movimientos")}><RamaxIcon name="points" />Mis puntos<RamaxIcon name="chevron" /></Link><div><RamaxIcon name="account" />{member.accessMethod === "pilot" ? "Cuenta de prueba" : "Cuenta de Google"} <small>{member.accessMethod === "pilot" ? "Piloto Ramax" : member.email}</small></div><form onSubmit={(event) => void updatePhone(event)}><label>Teléfono opcional<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Agregar teléfono" inputMode="tel" /></label><button disabled={saving || phone === (member.phone ?? "")}>{saving ? "Guardando…" : "Guardar teléfono"}</button></form><button onClick={() => void logout()}>Cerrar sesión<RamaxIcon name="chevron" /></button></div>
  </>;
  else if (screen === "beneficios") content = <><h1>Beneficios</h1><section className="club-points-strip"><PointsBadge /><p><strong>{balance}</strong><span>puntos confirmados</span></p></section><div className="club-live-coming"><RamaxIcon name="rewards" size={42} /><h2>Próximamente</h2><p>Pronto vas a poder usar tus puntos para pedir recompensas.</p></div></>;
  else content = <><h1>Pantalla no encontrada</h1><Link className="club-button" to={path("inicio")}>Ir al inicio</Link></>;

  return <div className="club-demo club-live"><ClubHeader member={member} /><main className="club-body">{error && <p role="alert" className="club-live-error">{error}</p>}{content}</main><ClubBottom active={active} /></div>;
}
