import { useState } from "react";
import type { StaffMemberLookup } from "@ramax/contracts";
import { isMemberNumber } from "@ramax/contracts";
import { apiRequest } from "./session";
import { Notice } from "./ui";
import { salesDate } from "./sales-format";

export function useMemberPicker() {
  const [number, setNumber] = useState("");
  const [member, setMember] = useState<StaffMemberLookup>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function change(value: string) {
    setNumber(value.replace(/\D/g, "").slice(0, 6));
    setMember(undefined);
    setError(undefined);
  }

  async function find() {
    if (!isMemberNumber(number) || busy) return;
    setBusy(true);
    setError(undefined);
    setMember(undefined);
    try {
      setMember(await apiRequest<StaffMemberLookup>(`/members/by-number/${number}`));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setNumber("");
    setMember(undefined);
    setError(undefined);
  }

  return { number, member, busy, error, change, find, reset };
}

export function MemberPicker({ picker }: { picker: ReturnType<typeof useMemberPicker> }) {
  return <div className="sales-member">
    <h2 className="sales-section-title">Socio del club <small>Opcional</small></h2>
    <p className="sales-info">Buscá su número de seis dígitos.</p>
    <div className="sales-member__search">
      <input aria-label="Número de socio" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="Número de socio" value={picker.number} onChange={(event) => picker.change(event.target.value)} />
      <button type="button" disabled={!isMemberNumber(picker.number) || picker.busy} onClick={() => void picker.find()}>{picker.busy ? "Buscando…" : "Buscar"}</button>
    </div>
    <Notice error={picker.error} />
    {picker.member && <div className="sales-member__result">
      <div><strong>{picker.member.displayName}</strong><span>N.º {picker.member.memberNumber} · {picker.member.status === "active" ? "Activo" : "Suspendido"}</span></div>
      <p>Saldo confirmado: {picker.member.confirmedBalance} puntos</p>
      {picker.member.source === "cache" && <small>Última información guardada: {salesDate(picker.member.syncedAt)}. Los puntos quedarán pendientes.</small>}
      {picker.member.status !== "active" && <small>Este socio no puede acumular puntos.</small>}
      {picker.member.status === "active" && <button type="button" onClick={picker.reset}>Quitar socio</button>}
    </div>}
    {!picker.member && !picker.error && <p className="sales-info">Podés continuar sin socio y asociar esta venta desde el historial durante 24 horas.</p>}
  </div>;
}
