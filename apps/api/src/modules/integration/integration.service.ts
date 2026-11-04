import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { SaleSyncAck } from "../../../../../packages/contracts/src";
import { calculatePoints, isMemberNumber } from "../../../../../packages/contracts/src";
import {
  cloudSales,
  inboxEvents,
  members,
  pointLedger,
  pointRules,
} from "../../../../../db/cloud-schema";
import { CLOUD_DATABASE } from "../../cloud-database/cloud-database.module";
import type { CloudDatabase } from "../../cloud-database/cloud-database.types";
import { PointsService, type CloudTransaction } from "../points/points.service";
import { SyncEventDto } from "./dto/sync-event.dto";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function eventHash(event: SyncEventDto): string {
  return createHash("sha256").update(canonical(event)).digest("hex");
}

@Injectable()
export class IntegrationService {
  private readonly sourceId: string;

  constructor(
    @Inject(CLOUD_DATABASE) private readonly db: CloudDatabase,
    private readonly points: PointsService,
    config: ConfigService,
  ) {
    this.sourceId = config.getOrThrow<string>("CLUB_SOURCE_ID");
  }

  async lookup(memberNumber: string) {
    if (!isMemberNumber(memberNumber))
      throw new BadRequestException("Ingresá los seis dígitos del socio.");
    const [member] = await this.db
      .select({
        id: members.id,
        memberNumber: members.memberNumber,
        displayName: members.displayName,
        status: members.status,
      })
      .from(members)
      .where(eq(members.memberNumber, memberNumber));
    if (!member || member.status === "anonymized")
      throw new NotFoundException("No encontramos ese socio.");
    return {
      id: member.id,
      memberNumber: member.memberNumber,
      displayName: member.displayName ?? "Socio",
      status: member.status,
      confirmedBalance: await this.points.balance(member.id),
      syncedAt: new Date().toISOString(),
      source: "cloud" as const,
    };
  }

  async currentRule() {
    const [rule] = await this.db
      .select()
      .from(pointRules)
      .where(lte(pointRules.effectiveAt, new Date()))
      .orderBy(desc(pointRules.version))
      .limit(1);
    if (!rule)
      throw new ServiceUnavailableException("La regla de puntos aún no está configurada.");
    return {
      version: rule.version,
      pesosPorPunto: rule.pesosPorPunto,
      effectiveAt: rule.effectiveAt.toISOString(),
    };
  }

  async receive(event: SyncEventDto): Promise<SaleSyncAck> {
    if (event.sourceId !== this.sourceId)
      throw new ConflictException("La sucursal no coincide con esta integración.");
    if (event.eventType === "sale.closed") this.validateClose(event);
    if (event.eventType === "sale.member_attached" && !event.memberId)
      throw new BadRequestException("Falta el socio de la asociación.");

    const hash = eventHash(event);
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${event.sourceId + event.saleId}, 0))`,
      );
      const [duplicate] = await tx
        .select()
        .from(inboxEvents)
        .where(eq(inboxEvents.eventId, event.eventId));
      if (duplicate) {
        if (duplicate.payloadHash !== hash)
          throw new ConflictException("El evento ya existe con otros datos.");
        return duplicate.result as SaleSyncAck;
      }

      const [sale] = await tx
        .select()
        .from(cloudSales)
        .where(
          and(
            eq(cloudSales.sourceId, event.sourceId),
            eq(cloudSales.saleId, event.saleId),
          ),
        )
        .for("update");
      if (event.saleVersion > (sale?.processedVersion ?? 0) + 1)
        return { eventId: event.eventId, status: "deferred" };
      if (event.saleVersion <= (sale?.processedVersion ?? 0)) {
        const ack: SaleSyncAck = {
          eventId: event.eventId,
          status: "rejected",
          code: "SALE_VERSION_CONFLICT",
        };
        await this.storeAck(tx, event, hash, ack);
        return ack;
      }

      let ack: SaleSyncAck;
      switch (event.eventType) {
        case "sale.closed":
          if (sale || event.saleVersion !== 1)
            throw new ConflictException("Versión inicial de venta inválida.");
          ack = await this.close(tx, event);
          break;
        case "sale.member_attached":
          if (!sale || sale.status !== "closed" || sale.memberId)
            throw new ConflictException("La venta no admite asociación.");
          ack = await this.attach(tx, sale, event);
          break;
        case "sale.voided":
          if (!sale || sale.status !== "closed")
            throw new ConflictException("La venta no admite anulación.");
          ack = await this.void(tx, sale, event);
          break;
      }
      await this.storeAck(tx, event, hash, ack);
      return ack;
    });
  }

  private validateClose(event: SyncEventDto) {
    if (
      event.saleVersion !== 1 ||
      !event.saleNumber ||
      event.totalArs === undefined ||
      !event.closedAt ||
      !event.pointRuleVersion ||
      !event.pesosPorPunto ||
      event.pointsEarned === undefined
      || !event.items?.length
    )
      throw new BadRequestException("El evento de cierre está incompleto.");
    if (calculatePoints(event.totalArs, event.pesosPorPunto) !== event.pointsEarned)
      throw new BadRequestException("Los puntos no coinciden con la regla guardada.");
    if (
      event.items!.some((item) => item.quantity * item.unitPriceArs !== item.subtotalArs) ||
      event.items!.reduce((sum, item) => sum + item.subtotalArs, 0) !== event.totalArs
    )
      throw new BadRequestException("Los artículos no coinciden con el total de venta.");
  }

  private async close(tx: CloudTransaction, event: SyncEventDto): Promise<SaleSyncAck> {
    const [rule] = await tx
      .select()
      .from(pointRules)
      .where(eq(pointRules.version, event.pointRuleVersion!));
    const ruleValid = rule?.pesosPorPunto === event.pesosPorPunto;
    await tx.insert(cloudSales).values({
      sourceId: event.sourceId,
      saleId: event.saleId,
      saleNumber: event.saleNumber!,
      totalArs: event.totalArs!,
      items: event.items!,
      pointRuleVersion: event.pointRuleVersion,
      pesosPorPunto: event.pesosPorPunto,
      pointsEarned: event.pointsEarned,
      closedAt: new Date(event.closedAt!),
      processedVersion: 1,
    });
    if (!ruleValid)
      return { eventId: event.eventId, status: "rejected", code: "UNKNOWN_POINT_RULE" };
    if (!event.memberId)
      return { eventId: event.eventId, status: "accepted" };
    const member = await this.activeMember(tx, event.memberId);
    if (!member)
      return { eventId: event.eventId, status: "rejected", code: "MEMBER_INACTIVE" };
    await tx
      .update(cloudSales)
      .set({ memberId: member.id })
      .where(and(eq(cloudSales.sourceId, event.sourceId), eq(cloudSales.saleId, event.saleId)));
    const confirmedBalance = await this.points.creditSale(
      tx,
      member.id,
      this.creditKey(event.sourceId, event.saleId),
      event.pointsEarned!,
      `Venta N.º ${event.saleNumber}`,
    );
    return { eventId: event.eventId, status: "accepted", confirmedBalance };
  }

  private async attach(
    tx: CloudTransaction,
    sale: typeof cloudSales.$inferSelect,
    event: SyncEventDto,
  ): Promise<SaleSyncAck> {
    const [rule] = sale.pointRuleVersion
      ? await tx
          .select()
          .from(pointRules)
          .where(eq(pointRules.version, sale.pointRuleVersion))
      : [];
    const ruleValid = rule?.pesosPorPunto === sale.pesosPorPunto;
    const member = await this.activeMember(tx, event.memberId!);
    await tx
      .update(cloudSales)
      .set({ processedVersion: event.saleVersion, memberId: ruleValid ? member?.id ?? null : null })
      .where(and(eq(cloudSales.sourceId, event.sourceId), eq(cloudSales.saleId, event.saleId)));
    if (!ruleValid)
      return { eventId: event.eventId, status: "rejected", code: "UNKNOWN_POINT_RULE" };
    if (!member)
      return { eventId: event.eventId, status: "rejected", code: "MEMBER_INACTIVE" };
    const confirmedBalance = await this.points.creditSale(
      tx,
      member.id,
      this.creditKey(event.sourceId, event.saleId),
      sale.pointsEarned ?? 0,
      `Venta N.º ${sale.saleNumber}`,
    );
    return { eventId: event.eventId, status: "accepted", confirmedBalance };
  }

  private async void(
    tx: CloudTransaction,
    sale: typeof cloudSales.$inferSelect,
    event: SyncEventDto,
  ): Promise<SaleSyncAck> {
    await tx
      .update(cloudSales)
      .set({
        status: "void",
        voidedAt: new Date(event.occurredAt),
        processedVersion: event.saleVersion,
      })
      .where(and(eq(cloudSales.sourceId, event.sourceId), eq(cloudSales.saleId, event.saleId)));
    if (!sale.memberId || !sale.pointsEarned)
      return { eventId: event.eventId, status: "accepted" };
    const creditCauseKey = this.creditKey(event.sourceId, event.saleId);
    const [credit] = await tx
      .select({ id: pointLedger.id })
      .from(pointLedger)
      .where(eq(pointLedger.causeKey, creditCauseKey));
    if (!credit) return { eventId: event.eventId, status: "accepted" };
    const confirmedBalance = await this.points.reverseSale(
      tx,
      sale.memberId,
      `reversal:${event.sourceId}:${event.saleId}`,
      creditCauseKey,
      sale.pointsEarned,
      `Anulación de venta N.º ${sale.saleNumber}`,
    );
    return { eventId: event.eventId, status: "accepted", confirmedBalance };
  }

  private creditKey(sourceId: string, saleId: string) {
    return `credit:${sourceId}:${saleId}`;
  }

  private async activeMember(tx: CloudTransaction, id: string) {
    const [member] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, id), eq(members.status, "active")));
    return member;
  }

  private async storeAck(
    tx: CloudTransaction,
    event: SyncEventDto,
    payloadHash: string,
    result: SaleSyncAck,
  ) {
    await tx.insert(inboxEvents).values({
      eventId: event.eventId,
      sourceId: event.sourceId,
      saleId: event.saleId,
      saleVersion: event.saleVersion,
      eventType: event.eventType,
      payloadHash,
      result,
    });
  }
}
