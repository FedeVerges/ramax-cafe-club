import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const memberStatus = pgEnum("member_status", [
  "active",
  "suspended",
  "anonymized",
]);

export const members = pgTable(
  "members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberNumber: varchar("member_number", { length: 6 }).notNull(),
    googleSub: varchar("google_sub", { length: 255 }),
    displayName: varchar("display_name", { length: 160 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 40 }),
    status: memberStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("members_number_unique").on(table.memberNumber),
    uniqueIndex("members_google_sub_unique").on(table.googleSub),
    check("members_number_six_digits", sql`${table.memberNumber} ~ '^[0-9]{6}$'`),
  ],
);

export const memberSessions = pgTable("member_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "restrict" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pointRules = pgTable(
  "point_rules",
  {
    version: integer("version").primaryKey(),
    pesosPorPunto: integer("pesos_por_punto").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByStaffId: uuid("created_by_staff_id"),
  },
  (table) => [check("point_rules_value_positive", sql`${table.pesosPorPunto} > 0`)],
);

export const pointLedger = pgTable(
  "point_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "restrict" }),
    causeKey: varchar("cause_key", { length: 255 }).notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    delta: integer("delta").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("point_ledger_cause_unique").on(table.causeKey),
    check("point_ledger_delta_nonzero", sql`${table.delta} <> 0`),
  ],
);

export const pointLots = pgTable(
  "point_lots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "restrict" }),
    creditLedgerId: uuid("credit_ledger_id").notNull().unique().references(() => pointLedger.id, { onDelete: "restrict" }),
    originalPoints: integer("original_points").notNull(),
    remainingPoints: integer("remaining_points").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
  },
  (table) => [
    check("point_lots_original_positive", sql`${table.originalPoints} > 0`),
    check("point_lots_remaining_nonnegative", sql`${table.remainingPoints} >= 0`),
    check("point_lots_remaining_bounded", sql`${table.remainingPoints} <= ${table.originalPoints}`),
  ],
);

export const pointAllocations = pgTable(
  "point_allocations",
  {
    debitLedgerId: uuid("debit_ledger_id").notNull().references(() => pointLedger.id, { onDelete: "restrict" }),
    lotId: uuid("lot_id").notNull().references(() => pointLots.id, { onDelete: "restrict" }),
    points: integer("points").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.debitLedgerId, table.lotId] }),
    check("point_allocations_positive", sql`${table.points} > 0`),
  ],
);

export const cloudSales = pgTable(
  "cloud_sales",
  {
    sourceId: uuid("source_id").notNull(),
    saleId: uuid("sale_id").notNull(),
    saleNumber: integer("sale_number").notNull(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "restrict" }),
    totalArs: integer("total_ars").notNull(),
    items: jsonb("items").notNull().default([]),
    pointRuleVersion: integer("point_rule_version"),
    pesosPorPunto: integer("pesos_por_punto"),
    pointsEarned: integer("points_earned"),
    status: varchar("status", { length: 16 }).notNull().default("closed"),
    processedVersion: integer("processed_version").notNull().default(0),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.sourceId, table.saleId] })],
);

export const inboxEvents = pgTable("inbox_events", {
  eventId: uuid("event_id").primaryKey(),
  sourceId: uuid("source_id").notNull(),
  saleId: uuid("sale_id").notNull(),
  saleVersion: integer("sale_version").notNull(),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  result: jsonb("result").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cloudAuditEvents = pgTable("cloud_audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorType: varchar("actor_type", { length: 20 }).notNull(),
  actorId: varchar("actor_id", { length: 255 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityId: text("entity_id").notNull(),
  reason: text("reason"),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminCommands = pgTable(
  "admin_commands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id").notNull(),
    actorStaffId: uuid("actor_staff_id").notNull(),
    scope: varchar("scope", { length: 100 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("admin_commands_idempotency_unique").on(
      table.sourceId,
      table.actorStaffId,
      table.scope,
      table.key,
    ),
  ],
);
