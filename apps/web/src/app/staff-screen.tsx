import { useState, type FormEvent } from "react";
import type { StaffUser } from "@ramax/contracts";
import { AdminCard, AdminHeading, AdminSearch } from "./admin-ui";
import { RamaxIcon, StatusPill } from "./brand-ui";
import { useStaff } from "./staff-context";
import { Notice, useData, useMutation } from "./ui";

export function StaffScreen() {
  const staff = useData<StaffUser[]>("/staff");
  const mutation = useMutation();
  const currentUserId = useStaff().user.id;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [resetUser, setResetUser] = useState<StaffUser>();
  const [showPassword, setShowPassword] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const visible = (staff.data ?? []).filter((user) =>
    `${user.displayName} ${user.username}`.toLowerCase().includes(search.toLowerCase()) &&
    (!status || user.active === (status === "active")),
  );

  function clearForm() {
    setResetUser(undefined);
    setShowPassword(false);
    setFormVersion((value) => value + 1);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const body = resetUser
      ? { password }
      : {
          displayName: String(form.get("displayName")),
          username: String(form.get("username")),
          role: String(form.get("role")),
          password,
        };
    const result = await mutation.run(
      resetUser ? `/staff/${resetUser.id}/password` : "/staff",
      body,
    );
    if (result) {
      clearForm();
      staff.reload();
    }
  }

  async function deactivate(user: StaffUser) {
    if (!window.confirm(`¿Desactivar la cuenta de ${user.displayName}? Se cerrarán sus sesiones.`)) return;
    const result = await mutation.run(`/staff/${user.id}/deactivate`, {});
    if (result) staff.reload();
  }

  return (
    <section className="admin-page admin-staff">
      <AdminHeading title="Equipo" subtitle="Cuentas de acceso al local" />
      <Notice error={staff.error ?? mutation.error} success={mutation.success} />
      <div className="admin-grid">
        <div className="admin-primary">
          <div className="admin-toolbar admin-toolbar--staff">
            <AdminSearch value={search} onChange={setSearch} placeholder="Buscar por nombre o usuario..." />
            <label className="admin-filter"><span>Ver</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todas las cuentas</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></label>
          </div>
          <div className="admin-table-wrap admin-staff__table">
            <table>
              <thead><tr><th>Nombre</th><th>Usuario</th><th>Perfil</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id}>
                    <td className="admin-table-strong">{user.displayName}</td>
                    <td>{user.username}</td>
                    <td>{user.role === "admin" ? "Administrador" : "Empleado"}</td>
                    <td><StatusPill tone={user.active ? "success" : "neutral"}>{user.active ? "Activa" : "Inactiva"}</StatusPill></td>
                    <td><div className="admin-row-actions"><button type="button" onClick={() => { setResetUser(user); setFormVersion((value) => value + 1); }}>Restablecer contraseña</button>{user.active && user.id !== currentUserId ? <button type="button" className="admin-danger" disabled={mutation.busy} onClick={() => void deactivate(user)}>Desactivar</button> : <span aria-label="Sin acción disponible">—</span>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {staff.loading && <p className="admin-empty">Cargando equipo...</p>}
            {!staff.loading && visible.length === 0 && <p className="admin-empty">No hay cuentas para esta búsqueda.</p>}
          </div>
        </div>
        <AdminCard title={resetUser ? "Restablecer contraseña" : "Agregar persona"} className="admin-form-card">
          <form key={`${resetUser?.id ?? "new"}-${formVersion}`} onSubmit={save}>
            {resetUser ? <p className="admin-form-intro">Nueva contraseña para <strong>{resetUser.displayName}</strong></p> : <>
              <label>Nombre<input name="displayName" placeholder="Ej. Sofía Gómez" required maxLength={160} /></label>
              <label>Usuario<input name="username" placeholder="Ej. sofia" required pattern="[a-zA-Z0-9._@\-]+" maxLength={320} /></label>
              <label>Perfil<select name="role"><option value="employee">Empleado</option><option value="admin">Administrador</option></select></label>
            </>}
            <label>{resetUser ? "Nueva contraseña" : "Contraseña inicial"}<span className="admin-password"><input type={showPassword ? "text" : "password"} name="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" minLength={8} maxLength={128} required /><button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((value) => !value)}><RamaxIcon name={showPassword ? "hidden" : "visible"} size={22} /></button></span></label>
            <button className="button button--primary" disabled={mutation.busy}>{resetUser ? "Restablecer contraseña" : "Crear cuenta"}</button>
            <button type="button" className="button button--secondary" onClick={clearForm}>Cancelar</button>
            <p className="admin-helper">La cuenta del equipo es independiente de la cuenta de socio.</p>
          </form>
        </AdminCard>
      </div>
    </section>
  );
}
