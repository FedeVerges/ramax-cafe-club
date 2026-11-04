import { Inject, Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { and, asc, desc, eq, gt, lte, sql } from "drizzle-orm";
import {
  members,
  pointAllocations,
  pointLedger,
  pointLots,
} from "../../../../../db/cloud-schema";
import { CLOUD_DATABASE } from "../../cloud-database/cloud-database.module";
import type { CloudDatabase } from "../../cloud-database/cloud-database.types";

export type CloudTransaction = Parameters<
  Parameters<CloudDatabase["transaction"]>[0]
>[0];

async function balanceInTx(tx: CloudTransaction, memberId: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${pointLedger.delta}), 0)` })
    .from(pointLedger)
    .where(eq(pointLedger.memberId, memberId));
  return Number(row?.total ?? 0);
}

@Injectable()
export class PointsService {
  constructor(@Inject(CLOUD_DATABASE) private readonly db: CloudDatabase) {}

  async account(memberId: string, page = 1) {
    const [balanceRow, movements] = await Promise.all([
      this.db
        .select({ total: sql<string>`coalesce(sum(${pointLedger.delta}), 0)` })
        .from(pointLedger)
        .where(eq(pointLedger.memberId, memberId)),
      this.db
        .select({
          id: pointLedger.id,
          kind: pointLedger.kind,
          delta: pointLedger.delta,
          description: pointLedger.description,
          createdAt: pointLedger.createdAt,
        })
        .from(pointLedger)
        .where(eq(pointLedger.memberId, memberId))
        .orderBy(desc(pointLedger.createdAt), desc(pointLedger.id))
        .limit(26)
        .offset((page - 1) * 25),
    ]);
    return {
      confirmedBalance: Number(balanceRow[0]?.total ?? 0),
      movements: movements.slice(0, 25),
      hasMore: movements.length > 25,
    };
  }

  async balance(memberId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<string>`coalesce(sum(${pointLedger.delta}), 0)` })
      .from(pointLedger)
      .where(eq(pointLedger.memberId, memberId));
    return Number(row?.total ?? 0);
  }

  async creditSale(
    tx: CloudTransaction,
    memberId: string,
    causeKey: string,
    points: number,
    description: string,
    kind: "sale_credit" | "adjustment" = "sale_credit",
  ): Promise<number> {
    await tx.select({ id: members.id }).from(members).where(eq(members.id, memberId)).for("update");
    if (points <= 0) return balanceInTx(tx, memberId);
    const before = await balanceInTx(tx, memberId);
    const [entry] = await tx
      .insert(pointLedger)
      .values({
        memberId,
        causeKey,
        kind,
        delta: points,
        description,
      })
      .returning({ id: pointLedger.id });
    const available = Math.max(0, points + Math.min(before, 0));
    if (available > 0) {
      await tx.insert(pointLots).values({
        memberId,
        creditLedgerId: entry!.id,
        originalPoints: available,
        remainingPoints: available,
        expiresAt: sql`((now() AT TIME ZONE 'America/Argentina/San_Luis')::date + 365 + time '21:00') AT TIME ZONE 'America/Argentina/San_Luis'`,
      });
    }
    return before + points;
  }

  async reverseSale(
    tx: CloudTransaction,
    memberId: string,
    causeKey: string,
    creditCauseKey: string,
    points: number,
    description: string,
  ): Promise<number> {
    await tx.select({ id: members.id }).from(members).where(eq(members.id, memberId)).for("update");
    if (points <= 0) return balanceInTx(tx, memberId);
    const [expired] = await tx
      .select({ total: sql<string>`coalesce(sum(${pointAllocations.points}), 0)` })
      .from(pointAllocations)
      .innerJoin(pointLots, eq(pointAllocations.lotId, pointLots.id))
      .innerJoin(pointLedger, eq(pointLots.creditLedgerId, pointLedger.id))
      .where(
        and(
          eq(pointLedger.causeKey, creditCauseKey),
          sql`exists (select 1 from point_ledger debit where debit.id = ${pointAllocations.debitLedgerId} and debit.kind = 'expiry')`,
        ),
      );
    const debitPoints = Math.max(0, points - Number(expired?.total ?? 0));
    if (debitPoints === 0) return balanceInTx(tx, memberId);
    return this.debitPoints(tx, memberId, causeKey, debitPoints, description, "sale_reversal");
  }

  async adjust(
    tx: CloudTransaction,
    memberId: string,
    causeKey: string,
    delta: number,
    reason: string,
  ): Promise<number> {
    if (delta > 0)
      return this.creditSale(tx, memberId, causeKey, delta, reason, "adjustment");
    await tx.select({ id: members.id }).from(members).where(eq(members.id, memberId)).for("update");
    return this.debitPoints(tx, memberId, causeKey, -delta, reason, "adjustment");
  }

  private async debitPoints(
    tx: CloudTransaction,
    memberId: string,
    causeKey: string,
    debitPoints: number,
    description: string,
    kind: "sale_reversal" | "adjustment",
  ): Promise<number> {
    const before = await balanceInTx(tx, memberId);
    const [entry] = await tx
      .insert(pointLedger)
      .values({
        memberId,
        causeKey,
        kind,
        delta: -debitPoints,
        description,
      })
      .returning({ id: pointLedger.id });
    let remaining = debitPoints;
    const lots = await tx
      .select()
      .from(pointLots)
      .where(and(eq(pointLots.memberId, memberId), gt(pointLots.remainingPoints, 0)))
      .orderBy(asc(pointLots.expiresAt), asc(pointLots.id))
      .for("update");
    for (const lot of lots) {
      if (remaining <= 0) break;
      const used = Math.min(remaining, lot.remainingPoints);
      await tx
        .update(pointLots)
        .set({ remainingPoints: lot.remainingPoints - used })
        .where(eq(pointLots.id, lot.id));
      await tx.insert(pointAllocations).values({
        debitLedgerId: entry!.id,
        lotId: lot.id,
        points: used,
      });
      remaining -= used;
    }
    return before - debitPoints;
  }

  @Interval(60_000)
  async expireDue(): Promise<void> {
    const due = await this.db
      .select({ id: pointLots.id, memberId: pointLots.memberId })
      .from(pointLots)
      .where(and(lte(pointLots.expiresAt, new Date()), gt(pointLots.remainingPoints, 0)))
      .orderBy(asc(pointLots.expiresAt))
      .limit(100);
    for (const candidate of due) {
      await this.db.transaction(async (tx) => {
        await tx.select({ id: members.id }).from(members).where(eq(members.id, candidate.memberId)).for("update");
        const [lot] = await tx
          .select()
          .from(pointLots)
          .where(eq(pointLots.id, candidate.id))
          .for("update");
        if (!lot || lot.remainingPoints <= 0 || lot.expiresAt > new Date()) return;
        const [entry] = await tx
          .insert(pointLedger)
          .values({
            memberId: lot.memberId,
            causeKey: `expiry:${lot.id}`,
            kind: "expiry",
            delta: -lot.remainingPoints,
            description: "Vencimiento de puntos",
          })
          .onConflictDoNothing()
          .returning({ id: pointLedger.id });
        if (!entry) return;
        await tx.insert(pointAllocations).values({
          debitLedgerId: entry.id,
          lotId: lot.id,
          points: lot.remainingPoints,
        });
        await tx
          .update(pointLots)
          .set({ remainingPoints: 0, expiredAt: new Date() })
          .where(eq(pointLots.id, lot.id));
      });
    }
  }
}
