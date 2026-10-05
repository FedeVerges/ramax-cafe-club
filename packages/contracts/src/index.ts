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

export type PaymentMethod = "cash" | "transfer";

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
  expectedTotalArs: number;
  transferConfirmed?: boolean;
};

export type ClosedSale = {
  saleId: string;
  status: "closed";
  totalArs: number;
  saleNumber: number;
};

export type CreateProductInput = {
  name: string;
  sku?: string;
  category?: string;
  priceArs: number;
  tracksStock: boolean;
  minimumQuantity: number;
};

export type StaffRole = "employee" | "admin";
export type StaffUser = {
  id: string;
  username: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
};
export type CreateStaffInput = {
  username: string;
  displayName: string;
  role: StaffRole;
  password: string;
};
export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  delta: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
  responsible: string | null;
};
export type AdjustInventoryInput = {
  productId: string;
  delta: number;
  reason: string;
};
export type SaleSummary = {
  id: string;
  saleNumber: number;
  status: "closed" | "void";
  totalArs: number;
  createdAt: string;
  voidedAt: string | null;
  paymentMethod: PaymentMethod;
  responsible: string;
};
export type SaleDetail = SaleSummary & {
  items: Array<{
    productName: string;
    quantity: number;
    unitPriceArs: number;
    subtotalArs: number;
  }>;
  voidReason: string | null;
  voidedBy: string | null;
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type BackupInfo = {
  id: string;
  createdAt: string;
  status: "valid" | "failed";
  schemaVersion: string;
  error?: string;
};
export type RecoveryJob = {
  id: string;
  backupId: string;
  actorId: string;
  status: "pending" | "running" | "succeeded" | "failed";
  createdAt: string;
  error?: string;
};
export const STAFF_PERMISSIONS: Record<StaffRole, readonly string[]> = {
  employee: ["products.read", "inventory.read", "sales.create", "sales.read"],
  admin: [
    "products.read",
    "inventory.read",
    "sales.create",
    "sales.read",
    "products.manage",
    "inventory.adjust",
    "sales.void",
    "users.manage",
    "backups.manage",
  ],
};

export type RestoreBackupInput = { backupId: string; confirmed: true };
export type VoidSaleInput = { reason: string; refundConfirmed: true };
export type UpdateProductInput = Partial<
  Pick<
    CreateProductInput,
    "name" | "sku" | "category" | "priceArs" | "tracksStock"
  >
> & { active?: boolean; description?: string };
