export const APP_ROLES = ["member", "employee", "admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AuthenticatedSession = {
  authenticated: true;
  user: {
    id: string;
    displayName: string;
    primaryRole: AppRole;
    roles: AppRole[];
    permissions: string[];
  };
  homePath: "/club" | "/operacion" | "/admin";
};

export type AnonymousSession = {
  authenticated: false;
};

export type Session = AuthenticatedSession | AnonymousSession;

export function homePathFor(role: AppRole): AuthenticatedSession["homePath"] {
  switch (role) {
    case "member":
      return "/club";
    case "employee":
      return "/operacion";
    case "admin":
      return "/admin";
  }
}

export type PaymentMethod = "cash" | "transfer" | "mercado_pago" | "card" | "other";

/** Datos de catálogo que el frontend puede consumir sin conocer las tablas. */
export type SaleProduct = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  priceArs: number;
  tracksStock: boolean;
  status: "active" | "inactive";
  quantity: number;
  minimumQuantity: number;
};

export type CloseSaleInput = {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: PaymentMethod;
};

export type ClosedSale = {
  saleId: string;
  status: "closed";
  totalArs: number;
};

export type CreateProductInput = {
  name: string;
  sku?: string;
  category?: string;
  priceArs: number;
  tracksStock: boolean;
  initialQuantity: number;
  minimumQuantity: number;
};
