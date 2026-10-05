import type {
  AuthenticatedSession,
  CloseSaleInput,
  ClosedSale,
  CreateProductInput,
  SaleProduct,
  Session,
} from "@ramax/contracts";
const apiBaseUrl = import.meta.env.VITE_API_URL ?? "/api/v1";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: "include",
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      "No pudimos contactar al servidor local. Conservá el pedido y reintentá.",
      0,
    );
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
      code?: string;
    };
    throw new ApiError(
      Array.isArray(body.message)
        ? body.message.join(". ")
        : (body.message ?? "No pudimos completar la operación."),
      response.status,
      body.code,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
export function getSession(): Promise<Session> {
  return apiRequest("/auth/me");
}
export function staffLogin(
  username: string,
  password: string,
): Promise<AuthenticatedSession> {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}
export function getSaleProducts(): Promise<SaleProduct[]> {
  return apiRequest("/products");
}
export function closeSale(
  input: CloseSaleInput,
  key: string,
): Promise<ClosedSale> {
  return apiRequest("/sales", {
    method: "POST",
    headers: { "idempotency-key": key },
    body: JSON.stringify(input),
  });
}
export function createProduct(
  input: CreateProductInput,
  key: string,
): Promise<SaleProduct> {
  return apiRequest("/products", {
    method: "POST",
    headers: { "idempotency-key": key },
    body: JSON.stringify(input),
  });
}
