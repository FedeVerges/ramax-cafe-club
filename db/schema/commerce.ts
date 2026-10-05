import {
  boolean,
  check,
  serial,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity";

export const productStatus = pgEnum("product_status", ["active", "inactive"]);
export const stockMovementType = pgEnum("stock_movement_type", [
  "opening",
  "sale",
  "sale_reversal",
  "adjustment",
  "import",
]);
export const saleStatus = pgEnum("sale_status", ["closed", "void"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "transfer"]);
export const paymentStatus = pgEnum("payment_status", ["recorded", "refunded"]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: varchar("sku", { length: 64 }),
    name: varchar("name", { length: 160 }).notNull(),
    category: varchar("category", { length: 100 }),
    description: text("description"),
    priceArs: integer("price_ars").notNull(),
    tracksStock: boolean("tracks_stock").notNull().default(true),
    status: productStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("products_sku_unique").on(table.sku),
    check("products_price_positive", sql`${table.priceArs} > 0`),
  ],
);

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    productId: uuid("product_id")
      .primaryKey()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    minimumQuantity: integer("minimum_quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("inventory_minimum_non_negative", sql`${table.minimumQuantity} >= 0`),
    check("inventory_quantity_non_negative", sql`${table.quantity} >= 0`),
  ],
);

export const sales = pgTable("sales", {
  saleNumber: serial("sale_number").notNull().unique(),
  id: uuid("id").defaultRandom().primaryKey(),
  status: saleStatus("status").notNull().default("closed"),
  totalArs: integer("total_ars").notNull(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  voidedByUserId: uuid("voided_by_user_id").references(() => users.id, {
    onDelete: "restrict",
  }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: text("void_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: varchar("product_name", { length: 160 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceArs: integer("unit_price_ars").notNull(),
    subtotalArs: integer("subtotal_ars").notNull(),
    tracksStock: boolean("tracks_stock").notNull(),
  },
  (table) => [
    check("sale_items_quantity_positive", sql`${table.quantity} > 0`),
    check("sale_items_price_non_negative", sql`${table.unitPriceArs} >= 0`),
  ],
);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id")
    .notNull()
    .unique()
    .references(() => sales.id, { onDelete: "restrict" }),
  method: paymentMethod("method").notNull(),
  amountArs: integer("amount_ars").notNull(),
  status: paymentStatus("status").notNull().default("recorded"),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundedByUserId: uuid("refunded_by_user_id").references(() => users.id, {
    onDelete: "restrict",
  }),
});

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "restrict" }),
  type: stockMovementType("type").notNull(),
  delta: integer("delta").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  reason: text("reason"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "restrict",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scope: varchar("scope", { length: 100 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    response: jsonb("response"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idempotency_scope_key_actor_unique").on(
      table.scope,
      table.key,
      table.actorUserId,
    ),
  ],
);
