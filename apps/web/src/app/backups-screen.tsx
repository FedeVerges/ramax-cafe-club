import { useEffect, useState } from "react";
import type { BackupInfo, RecoveryJob } from "@ramax/contracts";
import { date, Notice, useData, useMutation } from "./ui";
export function BackupsScreen() {
  const list = useData<{
    backups: BackupInfo[];
    jobs: RecoveryJob[];
    maintenance: boolean;
  }>("/backups");
  const mutation = useMutation();
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    const timer = setInterval(list.reload, 10000);
    return () => clearInterval(timer);
  }, []);
  const pending = list.data?.jobs.some((j) =>
    ["pending", "running"].includes(j.status),
  );
  return (
    <section>
      <h1>Copias de seguridad</h1>
      <p>Copia local diaria · Conservación de 30 días</p>
      <Notice error={list.error ?? mutation.error} />
      <div className="split-view">
        <div>
          {list.loading && !list.data && <p>Cargando…</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Seleccionar</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.backups.map((b) => (
                  <tr key={b.id}>
                    <td>{date(b.createdAt)}</td>
                    <td>
                      {b.status === "valid" ? "Correcta" : "Fallida"}
                      <small>{b.error}</small>
                    </td>
                    <td>
                      <button
                        disabled={b.status !== "valid" || pending}
                        onClick={() => {
                          setSelected(b.id);
                          setConfirmed(false);
                        }}
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.data?.backups.length === 0 && (
              <p>
                Todavía no hay copias. Verificá el servicio de recuperación.
              </p>
            )}
          </div>
          <h2>Restauraciones</h2>
          {list.data?.jobs.map((j) => (
            <p key={j.id}>
              {date(j.createdAt)} ·{" "}
              {
                {
                  pending: "Pendiente",
                  running: "En curso",
                  succeeded: "Restauración validada",
                  failed: "Fallida",
                }[j.status]
              }
              {j.error && <small>{j.error}</small>}
            </p>
          ))}
        </div>
        <div className="panel">
          <h2>Restaurar copia</h2>
          <p>
            {selected
              ? date(
                  list.data!.backups.find((b) => b.id === selected)!.createdAt,
                )
              : "Seleccioná una copia válida."}
          </p>
          <p>
            Se reemplazarán los datos locales. Podés perder las operaciones
            posteriores a esta copia.
          </p>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Entiendo qué datos se reemplazarán
          </label>
          <button
            disabled={!selected || !confirmed || mutation.busy || pending}
            onClick={() => {
              void mutation
                .run<RecoveryJob>("/backups/restore", {
                  backupId: selected,
                  confirmed,
                })
                .then(() => {
                  setConfirmed(false);
                  list.reload();
                });
            }}
          >
            Confirmar restauración
          </button>
          <p>
            Al restaurar se cerrarán las sesiones. Volvé a ingresar y consultá
            el resultado aquí.
          </p>
          <a href="/login">Volver a ingresar</a>
        </div>
      </div>
    </section>
  );
}
