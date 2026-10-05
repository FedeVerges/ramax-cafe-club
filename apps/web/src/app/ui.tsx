import { useEffect, useRef, useState } from "react";
import { apiRequest } from "./session";
export const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
export const date = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/San_Luis",
  }).format(new Date(value));
export function Notice({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="form-success" role="status">
          {success}
        </p>
      )}
    </>
  );
}
export function useData<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(undefined);
    void apiRequest<T>(path)
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1) };
}
export function useMutation() {
  const pending = useRef(false);
  const request = useRef<{ signature: string; key: string } | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  async function run<T>(
    path: string,
    body: unknown,
    method = "POST",
  ): Promise<T | undefined> {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    const signature = JSON.stringify([path, method, body]);
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    try {
      const value = await apiRequest<T>(path, {
        method,
        headers: { "idempotency-key": request.current.key },
        body: JSON.stringify(body),
      });
      request.current = undefined;
      setSuccess("Cambios guardados.");
      return value;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return undefined;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { run, busy, error, success };
}
