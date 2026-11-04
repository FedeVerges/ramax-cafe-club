import { useEffect, useState } from "react";
import type { BackupInfo, RecoveryJob } from "@ramax/contracts";
import { AdminCard, AdminHeading } from "./admin-ui";
import { RamaxIcon, StatusPill } from "./brand-ui";
import { date, Notice, useData, useMutation } from "./ui";

export function BackupsScreen() {
  const list = useData<{ backups: BackupInfo[]; jobs: RecoveryJob[]; maintenance: boolean }>("/backups");
  const mutation = useMutation();
  const [selectedId, setSelectedId] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    const timer = setInterval(list.reload, 10000);
    return () => clearInterval(timer);
  }, []);
  const pending = list.data?.jobs.some((job) => job.status === "pending" || job.status === "running") ?? false;
  const selected = list.data?.backups.find((backup) => backup.id === selectedId) ?? list.data?.backups.find((backup) => backup.status === "valid");
  const latest = list.data?.backups[0];

  async function restore() {
    if (!selected || !confirmed || pending) return;
    const result = await mutation.run<RecoveryJob>("/backups/restore", { backupId: selected.id, confirmed: true });
    if (result) {
      setConfirmed(false);
      list.reload();
    }
  }

  return (
    <section className="admin-page admin-backups">
      <AdminHeading title="Copias de seguridad" subtitle="Gestioná las copias locales de tu local." />
      <Notice error={list.error ?? mutation.error} success={mutation.success} />
      <AdminCard className="admin-backups__overview">
        <div className="admin-backups__local"><RamaxIcon name="backups" size={45} weight="light" /><div><h2>Copia local diaria</h2><p>{latest ? `Última copia: ${date(latest.createdAt)}` : "Todavía no hay copias"}</p></div>{latest && <StatusPill tone={latest.status === "valid" ? "success" : "warning"}>{latest.status === "valid" ? "Correcta" : "Fallida"}</StatusPill>}</div>
        <div className="admin-backups__cloud"><RamaxIcon name="backups" size={42} weight="light" /><div><strong>Copia central cifrada</strong><p>No configurada</p></div></div>
      </AdminCard>
      <div className="admin-backups__grid">
        <AdminCard title="Copias disponibles" className="admin-backups__list">
          <p>Seleccioná una copia para ver sus detalles y restaurarla.</p>
          <div className="admin-backups__table"><div className="admin-backups__table-head"><span>Fecha y hora</span><span>Origen</span><span>Estado</span></div>{list.data?.backups.map((backup) => <label key={backup.id} className={`admin-backups__row${selected?.id === backup.id ? " is-selected" : ""}`}><input type="radio" name="backup" checked={selected?.id === backup.id} disabled={backup.status !== "valid" || pending} onChange={() => { setSelectedId(backup.id); setConfirmed(false); }} /><span>{date(backup.createdAt)}</span><span>Local</span><span><StatusPill tone={backup.status === "valid" ? "success" : "warning"}>{backup.status === "valid" ? "Correcta" : "Fallida"}</StatusPill></span></label>)}{list.loading && <p className="admin-empty">Cargando copias...</p>}{!list.loading && !list.data?.backups.length && <p className="admin-empty">Todavía no hay copias. Verificá el servicio de recuperación.</p>}</div>
          {list.data?.jobs.length ? <div className="admin-backups__jobs"><h3>Restauraciones recientes</h3>{list.data.jobs.slice(0, 3).map((job) => <p key={job.id}>{date(job.createdAt)} · {{ pending: "Pendiente", running: "En curso", succeeded: "Validada", failed: "Fallida" }[job.status]}{job.error && <small>{job.error}</small>}</p>)}</div> : null}
        </AdminCard>
        <AdminCard title="Restaurar copia" className="admin-backups__restore">
          <p>Vas a restaurar la copia seleccionada.</p>
          <div className="admin-backups__selected"><RamaxIcon name="calendar" size={35} /><div><strong>{selected ? date(selected.createdAt) : "Ninguna copia seleccionada"}</strong><p>Origen: Local · Estado: {selected?.status === "valid" ? "Correcta" : "—"}</p></div></div>
          <div className="admin-backups__warning"><RamaxIcon name="warning" size={28} weight="fill" /><p><strong>Se reemplazarán los datos locales.</strong><br />Podés perder las operaciones posteriores a esta copia.</p></div>
          <label className="checkbox-field"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!selected || pending} />Entiendo qué datos se reemplazarán.</label>
          <button type="button" className="button button--primary" disabled={!selected || !confirmed || mutation.busy || pending} onClick={() => void restore()}>Confirmar restauración</button>
          <button type="button" className="button button--secondary" onClick={() => setConfirmed(false)}>Cancelar</button>
          {pending && <p role="status">Restauración en curso. Las escrituras están pausadas.</p>}
          <p className="admin-helper">Al restaurar se cerrarán las sesiones. Volvé a ingresar para consultar el resultado.</p>
        </AdminCard>
      </div>
    </section>
  );
}
