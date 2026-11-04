import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  adminCommands,
  cloudAuditEvents,
  memberSessions,
  members,
  pointLedger,
  pointRules,
} from "../../../../../db/cloud-schema";
import { CLOUD_DATABASE } from "../../cloud-database/cloud-database.module";
import type { CloudDatabase } from "../../cloud-database/cloud-database.types";
import { PointsService, type CloudTransaction } from "../points/points.service";
import { AdjustPointsDto, ChangeMemberStatusDto, SetPointRuleDto } from "./dto/admin.dto";

function hash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

@Injectable()
export class CloudAdminService {
  private readonly sourceId: string;

  constructor(
    @Inject(CLOUD_DATABASE) private readonly db: CloudDatabase,
    private readonly points: PointsService,
    config: ConfigService,
  ) {
    this.sourceId = config.getOrThrow<string>("CLUB_SOURCE_ID");
  }

  async listMembers() {
    const rows = await this.db
      .select({
        id: members.id,
        memberNumber: members.memberNumber,
        displayName: members.displayName,
        email: members.email,
        phone: members.phone,
        status: members.status,
        createdAt: members.createdAt,
        confirmedBalance: sql<string>`coalesce(sum(${pointLedger.delta}), 0)`,
      })
      .from(members)
      .leftJoin(pointLedger, eq(pointLedger.memberId, members.id))
      .groupBy(members.id)
      .orderBy(desc(members.createdAt))
      .limit(100);
    return rows.map((row) => ({
      ...row,
      confirmedBalance: Number(row.confirmedBalance),
    }));
  }

  async memberAccount(id: string) {
    const [member] = await this.db.select({
      id: members.id,
      memberNumber: members.memberNumber,
      displayName: members.displayName,
      email: members.email,
      phone: members.phone,
      status: members.status,
      createdAt: members.createdAt,
      updatedAt: members.updatedAt,
    }).from(members).where(eq(members.id, id));
    if (!member) throw new NotFoundException("No encontramos ese socio.");
    return { member, points: await this.points.account(id) };
  }

  async setRule(key: string, input: SetPointRuleDto) {
    return this.writeOnce("points.rule", key, input.actorStaffId, input, async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(714998)`);
      const [last] = await tx
        .select()
        .from(pointRules)
        .orderBy(desc(pointRules.version))
        .limit(1);
      if (last?.effectiveAt && last.effectiveAt > new Date())
        throw new ConflictException("Ya hay una regla pendiente de activación.");
      const effectiveAt = new Date(Date.now() + (last ? 60_000 : 0));
      const [rule] = await tx
        .insert(pointRules)
        .values({
          version: (last?.version ?? 0) + 1,
          pesosPorPunto: input.pesosPorPunto,
          effectiveAt,
          createdByStaffId: input.actorStaffId,
        })
        .returning();
      await tx.insert(cloudAuditEvents).values({
        actorType: "staff",
        actorId: input.actorStaffId,
        action: "points.rule_changed",
        entityId: String(rule!.version),
        before: last ? { version: last.version, pesosPorPunto: last.pesosPorPunto } : null,
        after: { version: rule!.version, pesosPorPunto: rule!.pesosPorPunto, effectiveAt },
      });
      return {
        version: rule!.version,
        pesosPorPunto: rule!.pesosPorPunto,
        effectiveAt: effectiveAt.toISOString(),
      };
    });
  }

  async changeStatus(id: string, key: string, input: ChangeMemberStatusDto) {
    return this.writeOnce(`member.status:${id}`, key, input.actorStaffId, input, async (tx) => {
      const [before] = await tx.select().from(members).where(eq(members.id, id)).for("update");
      if (!before || before.status === "anonymized")
        throw new NotFoundException("No encontramos ese socio.");
      const [member] = await tx
        .update(members)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(members.id, id))
        .returning();
      if (input.status === "suspended")
        await tx
          .update(memberSessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(memberSessions.memberId, id), sql`${memberSessions.revokedAt} is null`));
      await tx.insert(cloudAuditEvents).values({
        actorType: "staff",
        actorId: input.actorStaffId,
        action: `member.${input.status}`,
        entityId: id,
        reason: input.reason.trim(),
        before: { status: before.status },
        after: { status: input.status },
      });
      return { id: member!.id, status: member!.status };
    });
  }

  async adjustPoints(id: string, key: string, input: AdjustPointsDto) {
    return this.writeOnce(`points.adjust:${id}`, key, input.actorStaffId, input, async (tx) => {
      const [member] = await tx.select({ id: members.id, status: members.status }).from(members).where(eq(members.id, id));
      if (!member || member.status === "anonymized") throw new NotFoundException("No encontramos ese socio.");
      const confirmedBalance = await this.points.adjust(
        tx,
        id,
        `adjustment:${this.sourceId}:${input.actorStaffId}:${key}`,
        input.delta,
        input.reason.trim(),
      );
      await tx.insert(cloudAuditEvents).values({
        actorType: "staff",
        actorId: input.actorStaffId,
        action: "points.adjusted",
        entityId: id,
        reason: input.reason.trim(),
        after: { delta: input.delta, confirmedBalance },
      });
      return { memberId: id, confirmedBalance };
    });
  }

  private async writeOnce<T>(
    scope: string,
    key: string,
    actorStaffId: string,
    input: unknown,
    run: (tx: CloudTransaction) => Promise<T>,
  ): Promise<T> {
    if (!key?.trim() || key.length > 255)
      throw new BadRequestException("Falta una clave de idempotencia válida.");
    const requestHash = hash(input);
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${this.sourceId + actorStaffId + scope + key}, 0))`,
      );
      const [prior] = await tx
        .select()
        .from(adminCommands)
        .where(
          and(
            eq(adminCommands.sourceId, this.sourceId),
            eq(adminCommands.actorStaffId, actorStaffId),
            eq(adminCommands.scope, scope),
            eq(adminCommands.key, key),
          ),
        );
      if (prior) {
        if (prior.requestHash !== requestHash)
          throw new ConflictException("La clave ya se usó con otra solicitud.");
        return prior.response as T;
      }
      const response = await run(tx);
      await tx.insert(adminCommands).values({
        sourceId: this.sourceId,
        actorStaffId,
        scope,
        key,
        requestHash,
        response,
      });
      return response;
    });
  }
}
