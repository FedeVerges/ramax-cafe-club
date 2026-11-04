import type { ClubMemberProfile, PointAccount } from "@ramax/contracts";

export type ClubPurchase = {
  saleId: string;
  saleNumber: number;
  totalArs: number;
  items: Array<{
    productName: string;
    quantity: number;
    unitPriceArs: number;
    subtotalArs: number;
  }>;
  pointsEarned: number;
  status: "closed" | "void";
  closedAt: string;
};

const cloudBase = (import.meta.env.VITE_CLOUD_API_BASE ?? "/api/v1").replace(/\/$/, "");

async function cloudRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${cloudBase}/club${path}`, {
      credentials: "include",
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error("No pudimos conectar con el club. Reintentá cuando tengas internet.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    throw new Error(
      Array.isArray(body.message)
        ? body.message.join(". ")
        : body.message ?? "No pudimos completar la operación.",
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

async function csrfToken(): Promise<string> {
  const response = await cloudRequest<{ csrfToken: string }>("/auth/csrf");
  return response.csrfToken;
}

export function clubSession() {
  return cloudRequest<
    | { authenticated: false }
    | { authenticated: true; member: ClubMemberProfile }
  >("/auth/me");
}

export async function googleLogin(credential: string) {
  const csrf = await csrfToken();
  return cloudRequest<{ authenticated: true; member: ClubMemberProfile }>(
    "/auth/google",
    {
      method: "POST",
      headers: { "x-csrf-token": csrf },
      body: JSON.stringify({ credential }),
    },
  );
}

export function clubAuthMethods() {
  return cloudRequest<{ pilot: boolean }>("/auth/methods");
}

export async function pilotLogin(code: string) {
  const csrf = await csrfToken();
  return cloudRequest<{ authenticated: true; member: ClubMemberProfile }>(
    "/auth/pilot",
    {
      method: "POST",
      headers: { "x-csrf-token": csrf },
      body: JSON.stringify({ code }),
    },
  );
}

export function clubPoints(page = 1) {
  return cloudRequest<PointAccount>(`/points?page=${page}`);
}

export function clubPurchases(page = 1) {
  return cloudRequest<{ items: ClubPurchase[]; hasMore: boolean }>(`/purchases?page=${page}`);
}

export async function saveClubPhone(phone: string) {
  const csrf = await csrfToken();
  return cloudRequest<ClubMemberProfile>("/me", {
    method: "PATCH",
    headers: { "x-csrf-token": csrf },
    body: JSON.stringify({ phone: phone.trim() || null }),
  });
}

export async function clubLogout() {
  const csrf = await csrfToken();
  await cloudRequest<void>("/auth/logout", {
    method: "POST",
    headers: { "x-csrf-token": csrf },
  });
}
