import { useEffect, useState, type FormEvent } from "react";
import { AdminCard, AdminHeading, AdminSearch } from "./admin-ui";
import { StatusPill } from "./brand-ui";
import { apiRequest } from "./session";
import { date, Notice, useData, useMutation } from "./ui";

type MemberRow = {
  id: string;
  memberNumber: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: "active" | "suspended" | "anonymized";
  confirmedBalance: number;
  createdAt: string;
};
type MemberDetail = {
  member: MemberRow;
  points: {
    confirmedBalance: number;
    movements: Array<{ id: string; kind: string; delta: number; description: string; createdAt: string }>;
  };
};
type Rule = { version: number; pesosPorPunto: number; effectiveAt: string };
type RuleStatus = { active: Rule | null; pending: Rule | null };

export function ClubAdminScreen() {
  const members = useData<MemberRow[]>("/club-admin/members");
  const rules = useData<RuleStatus>("/club-admin/point-rule");
  const mutation = useMutation();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<MemberDetail>();
  const [detailError, setDetailError] = useState<string>();
  const [detailVersion, setDetailVersion] = useState(0);
  const [adjustment, setAdjustment] = useState<"add" | "subtract">("add");

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    setDetail(undefined);
    setDetailError(undefined);
    void apiRequest<MemberDetail>(`/club-admin/members/${selectedId}`)
      .then((result) => { if (alive) setDetail(result); })
      .catch((error: Error) => { if (alive) setDetailError(error.message); });
    return () => { alive = false; };
  }, [selectedId, detailVersion]);

  const visible = (members.data ?? []).filter((member) =>
    `${member.memberNumber} ${member.displayName} ${member.email ?? ""}`
      .toLocaleLowerCase("es-AR")
      .includes(query.toLocaleLowerCase("es-AR")),
  );

  function refresh() {
    members.reload();
    rules.reload();
    setDetailVersion((value) => value + 1);
  }

  async function changeStatus() {
    if (!detail) return;
    const status = detail.member.status === "active" ? "suspended" : "active";
    const reason = window.prompt(`Motivo para ${status === "suspended" ? "suspender" : "reactivar"} a ${detail.member.displayName}:`);
    if (!reason?.trim()) return;
    const result = await mutation.run(`/club-admin/members/${detail.member.id}/status`, { status, reason: reason.trim() });
    if (result) refresh();
  }

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    if (!detail) return;
    const form = new FormData(target);
    const points = Number(form.get("points"));
    const delta = adjustment === "add" ? points : -points;
    const reason = String(form.get("reason")).trim();
    const result = await mutation.run(`/club-admin/members/${detail.member.id}/points`, { delta, reason });
    if (result) {
      target.reset();
      refresh();
    }
  }

  async function setRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await mutation.run("/club-admin/point-rule", { pesosPorPunto: Number(form.get("pesosPorPunto")) });
    if (result) rules.reload();
  }

  return (
    <section className="admin-page admin-club">
      <AdminHeading title="Club Ramax" subtitle="Socios, puntos y regla de acreditación" />
      <Notice error={members.error ?? rules.error ?? detailError ?? mutation.error} success={mutation.success} />
      <div className="admin-club__rule admin-card">
        <div>
          <h2>Regla de puntos</h2>
          <p>{rules.data?.active ? <>1 punto cada <strong>${rules.data.active.pesosPorPunto.toLocaleString("es-AR")}</strong> · versión {rules.data.active.version}</> : "Todavía no hay una regla activa."}</p>
          {rules.data?.pending && <p className="admin-helper">Próxima regla: 1 punto cada ${rules.data.pending.pesosPorPunto.toLocaleString("es-AR")} desde {date(rules.data.pending.effectiveAt)}.</p>}
        </div>
        <form onSubmit={setRule}>
          <label>Pesos por punto<input key={rules.data?.active?.version ?? "initial"} name="pesosPorPunto" type="number" min="1" max="2147483647" step="1" defaultValue={rules.data?.active?.pesosPorPunto ?? 100} required aria-label="Nuevo valor de pesos por punto" /></label>
          <button className="button button--primary" disabled={mutation.busy || Boolean(rules.data?.pending)}>Cambiar regla</button>
        </form>
      </div>
      <div className="admin-grid admin-club__grid">
        <div className="admin-primary">
          <div className="admin-toolbar"><AdminSearch value={query} onChange={setQuery} placeholder="Buscar por número, nombre o email..." /></div>
          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>N.º de socio</th><th>Nombre</th><th>Estado</th><th>Saldo</th><th>Alta</th></tr></thead>
              <tbody>{visible.map((member) => <tr key={member.id} className={selectedId === member.id ? "is-selected" : ""}>
                <td><button type="button" className="admin-club__select" onClick={() => setSelectedId(member.id)}>{member.memberNumber}</button></td>
                <td className="admin-table-strong">{member.displayName}</td>
                <td><StatusPill tone={member.status === "active" ? "success" : "neutral"}>{member.status === "active" ? "Activo" : member.status === "suspended" ? "Suspendido" : "Anonimizado"}</StatusPill></td>
                <td>{member.confirmedBalance.toLocaleString("es-AR")}</td>
                <td>{date(member.createdAt)}</td>
              </tr>)}</tbody>
            </table>
            {members.loading && <p className="admin-empty">Cargando socios...</p>}
            {!members.loading && visible.length === 0 && <p className="admin-empty">No hay socios para esta búsqueda.</p>}
          </div>
        </div>
        <AdminCard title={detail ? detail.member.displayName : "Detalle del socio"} className="admin-club__detail">
          {!selectedId && <p className="admin-helper">Seleccioná un socio para consultar su libro de puntos y administrarlo.</p>}
          {selectedId && !detail && !detailError && <p>Cargando detalle...</p>}
          {detail && <>
            <dl className="admin-club__facts">
              <div><dt>Número</dt><dd>{detail.member.memberNumber}</dd></div>
              <div><dt>Email</dt><dd>{detail.member.email ?? "—"}</dd></div>
              <div><dt>Teléfono</dt><dd>{detail.member.phone ?? "—"}</dd></div>
              <div><dt>Saldo confirmado</dt><dd><strong>{detail.points.confirmedBalance.toLocaleString("es-AR")} puntos</strong></dd></div>
            </dl>
            {detail.member.status !== "anonymized" && <button type="button" className="button button--secondary" disabled={mutation.busy} onClick={() => void changeStatus()}>{detail.member.status === "active" ? "Suspender socio" : "Reactivar socio"}</button>}
            <h3>Movimientos</h3>
            <div className="admin-club__movements">{detail.points.movements.map((movement) => <div key={movement.id}><span><strong>{movement.description}</strong><small>{date(movement.createdAt)} · {movement.kind}</small></span><b className={movement.delta >= 0 ? "admin-positive" : "admin-negative"}>{movement.delta > 0 ? "+" : ""}{movement.delta}</b></div>)}{detail.points.movements.length === 0 && <p>Sin movimientos.</p>}</div>
            {detail.member.status !== "anonymized" && <form onSubmit={adjust} className="admin-club__adjust">
              <h3>Ajustar puntos</h3>
              <label>Operación<select value={adjustment} onChange={(event) => setAdjustment(event.target.value as "add" | "subtract")}><option value="add">Sumar</option><option value="subtract">Restar</option></select></label>
              <label>Puntos<input name="points" type="number" min="1" max="2147483647" step="1" required /></label>
              <label>Motivo<textarea name="reason" minLength={3} maxLength={500} required /></label>
              <button className="button button--primary" disabled={mutation.busy}>Guardar ajuste</button>
            </form>}
          </>}
        </AdminCard>
      </div>
    </section>
  );
}
