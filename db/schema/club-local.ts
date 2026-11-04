import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sales } from "./commerce";

export const memberCache = pgTable(
  "member_cache",
  {
    memberId: uuid("member_id").primaryKey(),
    memberNumber: varchar("member_number", { length: 6 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    confirmedBalance: integer("confirmed_balance").notNull().default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("member_cache_number_unique").on(table.memberNumber),
    check("member_cache_number_six_digits", sql`${table.memberNumber} ~ '^[0-9]{6}$'`),
  ],
);

export const pointRuleCache = pgTable(
  "point_rule_cache",
  {
    version: integer("version").primaryKey(),
    pesosPorPunto: integer("pesos_por_punto").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
  },
  (table) => [check("point_rule_cache_positive", sql`${table.pesosPorPunto} > 0`)],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    eventId: uuid("event_id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }),
    saleVersion: integer("sale_version").notNull(),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("outbox_sale_version_unique").on(table.saleId, table.saleVersion),
    check("outbox_version_positive", sql`${table.saleVersion} > 0`),
  ],
);
