import type { AuthenticatedSession, CloseSaleInput, ClosedSale, CreateProductInput, SaleProduct, Session } from "@ramax/contracts";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

export async function getSession(): Promise<Session> {
  const response = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include" });

  if (response.status === 401) {
    return { authenticated: false };
  }

  if (!response.ok) {
    throw new Error("No se pudo consultar la sesión.");
  }

  return (await response.json()) as Session;
}

export function googleLoginUrl(): string {
  return `${apiBaseUrl}/auth/google`;
}

export async function staffLogin(email: string, password: string): Promise<AuthenticatedSession> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
    throw new Error(body?.message ?? "No pudimos iniciar sesión.");
  }

  return (await response.json()) as AuthenticatedSession;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { message?: string | string[] } | undefined;
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new Error(message ?? "No pudimos completar la operación.");
  }
  return (await response.json()) as T;
}

export function getSaleProducts(): Promise<SaleProduct[]> {
  return apiRequest<SaleProduct[]>("/products");
}

export function closeSale(input: CloseSaleInput, idempotencyKey: string): Promise<ClosedSale> {
  return apiRequest<ClosedSale>("/sales", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function createProduct(input: CreateProductInput): Promise<SaleProduct> {
  return apiRequest<SaleProduct>("/products", { method: "POST", body: JSON.stringify(input) });
}
