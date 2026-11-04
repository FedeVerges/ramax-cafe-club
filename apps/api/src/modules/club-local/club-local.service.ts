import {
  BadRequestException,
  Inject,
  Injectable,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { and, asc, desc, eq, lte, or, sql } from "drizzle-orm";
import type {
  SaleSyncAck,
  SaleSyncEvent,
  StaffMemberLookup,
} from "../../../../../packages/contracts/src";
import { isMemberNumber } from "../../../../../packages/contracts/src";
import {
  memberCache,
  outboxEvents,
  pointRuleCache,
  sales,
} from "../../../../../db/schema";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import type { Transaction } from "../../common/idempotency";
import { inMaintenance } from "../backups/backup-files";

type CachedMember = typeof memberCache.$inferSelect;

@Injectable()
export class ClubLocalService {
  private readonly logger = new Logger(ClubLocalService.name);
  private readonly cloudUrl: string | undefined;
  private readonly serviceToken: string | undefined;
  readonly sourceId: string | undefined;
  private lastRuleRefresh = 0;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    config: ConfigService,
  ) {
    this.cloudUrl = config.get<string>("CLUB_CLOUD_API_URL")?.replace(/\/$/, "");
    this.serviceToken = config.get<string>("CLUB_SERVICE_TOKEN");
    this.sourceId = config.get<string>("CLUB_SOURCE_ID");
  }

  get configured(): boolean {
    return Boolean(this.cloudUrl && this.serviceToken && this.sourceId);
  }

  async lookup(number: string): Promise<StaffMemberLookup> {
    if (!isMemberNumber(number))
      throw new BadRequestException("Ingresá los seis dígitos del socio.");
    if (this.configured) {
      try {
        const response = await this.cloudFetch(`members/${number}`);
        if (response.status === 404)
          throw new NotFoundException("No encontramos ese socio.");
        if (response.status === 401 || response.status === 403)
          throw new ServiceUnavailableException("La conexión con el club necesita revisión.");
        if (response.ok) {
          const member = (await response.json()) as StaffMemberLookup;
          if (
            member.memberNumber !== number ||
            !["active", "suspended"].includes(member.status)
          )
            throw new ServiceUnavailableException("El club devolvió datos inesperados.");
          await this.db
            .insert(memberCache)
            .values({
              memberId: member.id,
              memberNumber: number,
              displayName: member.displayName,
              status: member.status,
              confirmedBalance: member.confirmedBalance,
              syncedAt: new Date(member.syncedAt),
            })
            .onConflictDoUpdate({
              target: memberCache.memberId,
              set: {
                memberNumber: number,
                displayName: member.displayName,
                status: member.status,
                confirmedBalance: member.confirmedBalance,
                syncedAt: new Date(member.syncedAt),
              },
            });
          return member;
        }
      } catch (error) {
        if (error instanceof NotFoundException || error instanceof ServiceUnavailableException)
          throw error;
        this.logger.warn(`Búsqueda cloud falló: ${(error as Error).message}`);
      }
    }
    const [cached] = await this.db
      .select()
      .from(memberCache)
      .where(eq(memberCache.memberNumber, number));
    if (!cached)
      throw new ServiceUnavailableException({
        code: "MEMBER_NOT_CACHED",
        message: "Sin conexión y sin datos de ese socio. Cerrá la venta sin socio y asociala después.",
      });
    return this.toLookup(cached);
  }

  private toLookup(cached: CachedMember): StaffMemberLookup {
    return {
      id: cached.memberId,
      memberNumber: cached.memberNumber,
      displayName: cached.displayName,
      status: cached.status as StaffMemberLookup["status"],
      confirmedBalance: cached.confirmedBalance,
      syncedAt: cached.syncedAt.toISOString(),
      source: "cache",
    };
  }

  async cachedActiveMember(tx: Transaction, number: string) {
    const [member] = await tx
      .select()
      .from(memberCache)
      .where(and(eq(memberCache.memberNumber, number), eq(memberCache.status, "active")));
    return member;
  }

  async cachedRule(tx: Transaction) {
    const [rule] = await tx
      .select()
      .from(pointRuleCache)
      .where(lte(pointRuleCache.effectiveAt, new Date()))
      .orderBy(desc(pointRuleCache.version))
      .limit(1);
    return rule;
  }

  async ruleStatus() {
    const rules = await this.db
      .select()
      .from(pointRuleCache)
      .orderBy(desc(pointRuleCache.version))
      .limit(2);
    return {
      active: rules.find((rule) => rule.effectiveAt <= new Date()) ?? null,
      pending: rules.find((rule) => rule.effectiveAt > new Date()) ?? null,
    };
  }

  async rememberRule(rule: { version: number; pesosPorPunto: number; effectiveAt: string }) {
    await this.db
      .insert(pointRuleCache)
      .values({
        version: rule.version,
        pesosPorPunto: rule.pesosPorPunto,
        effectiveAt: new Date(rule.effectiveAt),
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pointRuleCache.version,
        set: {
          pesosPorPunto: rule.pesosPorPunto,
          effectiveAt: new Date(rule.effectiveAt),
          syncedAt: new Date(),
        },
      });
  }

  async rememberMemberStatus(memberId: string, status: "active" | "suspended") {
    await this.db
      .update(memberCache)
      .set({ status, syncedAt: new Date() })
      .where(eq(memberCache.memberId, memberId));
  }

  async rememberMemberBalance(memberId: string, confirmedBalance: number) {
    await this.db
      .update(memberCache)
      .set({ confirmedBalance, syncedAt: new Date() })
      .where(eq(memberCache.memberId, memberId));
  }

  async adminRequest<T>(path: string, body?: unknown, key?: string): Promise<T> {
    if (!this.configured)
      throw new ServiceUnavailableException("El club aún no está configurado.");
    if (body !== undefined && (!key?.trim() || key.length > 255))
      throw new BadRequestException("Falta una clave de idempotencia válida.");
    let response: Response;
    try {
      response = await this.cloudFetch(`admin/${path}`, body, key);
    } catch {
      throw new ServiceUnavailableException("No pudimos conectar con el club.");
    }
    const data = (await response.json().catch(() => ({}))) as T & {
      message?: string | string[];
    };
    if (!response.ok)
      throw new HttpException(data, response.status);
    return data;
  }

  async enqueue(tx: Transaction, event: SaleSyncEvent): Promise<void> {
    await tx.insert(outboxEvents).values({
      eventId: event.eventId,
      saleId: event.saleId,
      saleVersion: event.saleVersion,
      eventType: event.eventType,
      payload: event,
    });
  }

  private cloudFetch(path: string, body?: unknown, key?: string): Promise<Response> {
    return fetch(`${this.cloudUrl}/integration/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${this.serviceToken}`,
        "content-type": "application/json",
        ...(key ? { "idempotency-key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5000),
    });
  }

  private async refreshRule(): Promise<void> {
    const response = await this.cloudFetch("point-rule");
    if (!response.ok) return;
    const rule = (await response.json()) as {
      version: number;
      pesosPorPunto: number;
      effectiveAt: string;
    };
    if (
      !Number.isSafeInteger(rule.version) ||
      !Number.isSafeInteger(rule.pesosPorPunto) ||
      rule.version < 1 ||
      rule.pesosPorPunto < 1 ||
      !Number.isFinite(Date.parse(rule.effectiveAt))
    )
      throw new Error("Regla cloud inválida");
    await this.rememberRule(rule);
  }

  @Interval(5000)
  async syncTick(): Promise<void> {
    if (!this.configured || inMaintenance()) return;
    if (Date.now() - this.lastRuleRefresh > 60_000) {
      this.lastRuleRefresh = Date.now();
      try {
        await this.refreshRule();
      } catch (error) {
        this.logger.warn(`No se pudo actualizar la regla: ${(error as Error).message}`);
      }
    }
    try {
      await this.sendNext();
    } catch (error) {
      this.logger.error(`Sincronización interrumpida: ${(error as Error).message}`);
    }
  }

  private async sendNext(): Promise<void> {
    const claimed = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [candidate] = await tx
        .select()
        .from(outboxEvents)
        .where(
          and(
            or(
              and(eq(outboxEvents.status, "pending"), lte(outboxEvents.nextAttemptAt, now)),
              and(eq(outboxEvents.status, "sending"), lte(outboxEvents.leaseUntil, now)),
            ),
            sql`not exists (
              select 1 from outbox_events prior
              where prior.sale_id = ${outboxEvents.saleId}
                and prior.sale_version < ${outboxEvents.saleVersion}
                and prior.status not in ('sent', 'rejected')
            )`,
          ),
        )
        .orderBy(asc(outboxEvents.createdAt), asc(outboxEvents.saleVersion))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!candidate) return undefined;
      await tx
        .update(outboxEvents)
        .set({
          status: "sending",
          leaseUntil: new Date(Date.now() + 30_000),
          attempts: candidate.attempts + 1,
        })
        .where(eq(outboxEvents.eventId, candidate.eventId));
      return candidate;
    });
    if (!claimed) return;
    try {
      const response = await this.cloudFetch("events", claimed.payload);
      const permanentError = [400, 409, 422].includes(response.status);
      if (!response.ok && !permanentError) throw new Error(`HTTP ${response.status}`);
      const ack = permanentError
        ? { eventId: claimed.eventId, status: "rejected" as const, code: `CLOUD_HTTP_${response.status}` }
        : (await response.json()) as SaleSyncAck;
      if (ack.eventId !== claimed.eventId)
        throw new Error("Acuse cloud de otro evento");
      const nextAttemptAt = new Date(Date.now() + this.backoff(claimed.attempts + 1));
      await this.db.transaction(async (tx) => {
        await tx
          .update(outboxEvents)
          .set({
            status:
              ack.status === "accepted"
                ? "sent"
                : ack.status === "rejected"
                  ? "rejected"
                  : "pending",
            nextAttemptAt,
            leaseUntil: null,
            lastError: ack.code ?? null,
            processedAt: ack.status === "deferred" ? null : new Date(),
          })
          .where(eq(outboxEvents.eventId, claimed.eventId));
        const event = claimed.payload as SaleSyncEvent;
        if (event.eventType === "sale.closed" && !event.memberId) return;
        const [currentSale] = await tx
          .select({ memberId: sales.memberId, saleVersion: sales.saleVersion })
          .from(sales)
          .where(eq(sales.id, claimed.saleId));
        if (currentSale?.saleVersion !== claimed.saleVersion) return;
        await tx
          .update(sales)
          .set({
            pointsSyncStatus:
              ack.status === "accepted"
                ? event.eventType === "sale.voided"
                  ? "reversed"
                  : "confirmed"
                : ack.status === "rejected"
                  ? "rejected"
                  : "pending",
          })
          .where(eq(sales.id, claimed.saleId));
        if (ack.confirmedBalance !== undefined) {
          const memberId = event.eventType === "sale.closed" ? event.memberId :
            event.eventType === "sale.member_attached" ? event.memberId : currentSale.memberId;
          if (memberId)
            await tx
              .update(memberCache)
              .set({ confirmedBalance: ack.confirmedBalance, syncedAt: new Date() })
              .where(eq(memberCache.memberId, memberId));
        }
      });
    } catch (error) {
      await this.db
        .update(outboxEvents)
        .set({
          status: "pending",
          leaseUntil: null,
          nextAttemptAt: new Date(Date.now() + this.backoff(claimed.attempts + 1)),
          lastError: (error as Error).message.slice(0, 500),
        })
        .where(eq(outboxEvents.eventId, claimed.eventId));
    }
  }

  private backoff(attempt: number): number {
    return Math.min(60_000, 1000 * 2 ** Math.min(attempt, 6)) + Math.floor(Math.random() * 500);
  }
}
