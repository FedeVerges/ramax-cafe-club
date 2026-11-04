import { writeOnce } from "../../common/idempotency";
import { randomUUID } from "node:crypto";
import { calculatePoints } from "../../../../../packages/contracts/src";
import { SaleQueryDto } from "./dto/sale-query.dto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, count, desc, eq, gte, lte, inArray, isNull, sql } from "drizzle-orm";
import {
  inventoryBalances,
  payments,
  products,
  saleItems,
  sales,
  stockMovements,
  users,
} from "../../../../../db/schema";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import { AuditService } from "../audit/audit.service";
import { Inject } from "@nestjs/common";
import { CloseSaleDto } from "./dto/close-sale.dto";
import { buildSaleSnapshot, SaleRuleError } from "./sale-policy";
import { ClubLocalService } from "../club-local/club-local.service";

type CloseSaleResponse = {
  saleId: string;
  status: "closed";
  totalArs: number;
  saleNumber: number;
  pointsEarned?: number;
  pointsSyncStatus?: "pending";
};

@Injectable()
export class SalesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly club: ClubLocalService,
  ) {}

  async list(query: SaleQueryDto) {
    const filter = and(
      query.number ? eq(sales.saleNumber, query.number) : undefined,
      query.status ? eq(sales.status, query.status) : undefined,
      query.paymentMethod
        ? eq(payments.method, query.paymentMethod)
        : undefined,
      query.from ? gte(sales.createdAt, new Date(query.from)) : undefined,
      query.to ? lte(sales.createdAt, new Date(query.to)) : undefined,
    );
    const items = await this.db
      .select({
        id: sales.id,
        saleNumber: sales.saleNumber,
        status: sales.status,
        totalArs: sales.totalArs,
        createdAt: sales.createdAt,
        voidedAt: sales.voidedAt,
        paymentMethod: payments.method,
        responsible: users.displayName,
        memberNumber: sales.memberNumber,
        pointsEarned: sales.pointsEarned,
        pointsSyncStatus: sales.pointsSyncStatus,
      })
      .from(sales)
      .innerJoin(payments, eq(payments.saleId, sales.id))
      .innerJoin(users, eq(users.id, sales.createdByUserId))
      .where(filter)
      .orderBy(desc(sales.saleNumber))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const [row] = await this.db
      .select({ total: count() })
      .from(sales)
      .innerJoin(payments, eq(payments.saleId, sales.id))
      .where(filter);
    return {
      items: items.map(({ memberNumber, ...item }) => ({
        ...item,
        memberNumberLast4: memberNumber?.slice(-4) ?? null,
      })),
      total: row?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async detail(id: string) {
    const [sale] = await this.db
      .select({
        id: sales.id,
        saleNumber: sales.saleNumber,
        status: sales.status,
        totalArs: sales.totalArs,
        createdAt: sales.createdAt,
        voidedAt: sales.voidedAt,
        voidReason: sales.voidReason,
        voidedByUserId: sales.voidedByUserId,
        paymentMethod: payments.method,
        responsible: users.displayName,
        memberNumber: sales.memberNumber,
        pointsEarned: sales.pointsEarned,
        pointsSyncStatus: sales.pointsSyncStatus,
      })
      .from(sales)
      .innerJoin(payments, eq(payments.saleId, sales.id))
      .innerJoin(users, eq(users.id, sales.createdByUserId))
      .where(eq(sales.id, id));
    if (!sale) throw new NotFoundException("No encontramos esa venta.");
    const items = await this.db
      .select({
        productName: saleItems.productName,
        quantity: saleItems.quantity,
        unitPriceArs: saleItems.unitPriceArs,
        subtotalArs: saleItems.subtotalArs,
      })
      .from(saleItems)
      .where(eq(saleItems.saleId, id));
    const [actor] = sale.voidedByUserId
      ? await this.db
          .select({ name: users.displayName })
          .from(users)
          .where(eq(users.id, sale.voidedByUserId))
      : [];
    const { memberNumber, ...detail } = sale;
    return {
      ...detail,
      memberNumberLast4: memberNumber?.slice(-4) ?? null,
      items,
      voidedBy: actor?.name ?? null,
    };
  }

  async close(
    actorUserId: string,
    idempotencyKey: string,
    input: CloseSaleDto,
  ): Promise<CloseSaleResponse> {
    if (input.paymentMethod === "transfer" && !input.transferConfirmed)
      throw new BadRequestException("Confirmá que recibiste la transferencia.");
    return writeOnce(
      this.db,
      actorUserId,
      "sales.close",
      idempotencyKey,
      input,
      async (tx) => {
        const productIds = [
          ...new Set(input.items.map((item) => item.productId)),
        ];
        const productRows = await tx
          .select()
          .from(products)
          .where(inArray(products.id, productIds))
          .orderBy(products.id)
          .for("share");
        if (productRows.length !== productIds.length)
          throw new BadRequestException("Uno de los productos ya no existe.");
        let snapshot;
        try {
          snapshot = buildSaleSnapshot(input.items, productRows);
        } catch (error) {
          if (error instanceof SaleRuleError)
            throw new BadRequestException(error.message);
          throw error;
        }
        const {
          items: itemSnapshots,
          totalArs,
          stockQuantities: quantities,
        } = snapshot;

        if (totalArs !== input.expectedTotalArs)
          throw new ConflictException({
            code: "PRICE_CHANGED",
            message:
              "Cambió el precio. Revisá el pedido y confirmá nuevamente.",
            totalArs,
          });
        const rule = this.club.configured ? await this.club.cachedRule(tx) : undefined;
        if (input.memberNumber && !rule)
          throw new ServiceUnavailableException(
            "La regla del club no está disponible. Cerrá la venta sin socio y asociala después.",
          );
        const member = input.memberNumber
          ? await this.club.cachedActiveMember(tx, input.memberNumber)
          : undefined;
        if (input.memberNumber && !member)
          throw new ConflictException({
            code: "MEMBER_NOT_READY",
            message: "Buscá y confirmá el socio antes de cobrar.",
          });
        const pointsEarned = rule
          ? calculatePoints(totalArs, rule.pesosPorPunto)
          : undefined;
        const closedAt = new Date();
        const [sale] = await tx
          .insert(sales)
          .values({
            totalArs,
            createdByUserId: actorUserId,
            createdAt: closedAt,
            memberId: member?.memberId,
            memberNumber: member?.memberNumber,
            memberAttachedAt: member ? closedAt : null,
            memberAttachedByUserId: member ? actorUserId : null,
            pointRuleVersion: rule?.version,
            pesosPorPunto: rule?.pesosPorPunto,
            pointsEarned,
            pointsSyncStatus: member ? "pending" : "none",
          })
          .returning();
        if (!sale) throw new ConflictException("No se pudo cerrar la venta.");
        await tx
          .insert(saleItems)
          .values(itemSnapshots.map((item) => ({ saleId: sale.id, ...item })));

        for (const [productId, quantity] of [...quantities].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          const product = productRows.find(
            (candidate) => candidate.id === productId,
          )!;
          if (!product.tracksStock) continue;
          const [balance] = await tx
            .update(inventoryBalances)
            .set({
              quantity: sql`${inventoryBalances.quantity} - ${quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(inventoryBalances.productId, productId),
                gte(inventoryBalances.quantity, quantity),
              ),
            )
            .returning();
          if (!balance)
            throw new ConflictException({
              code: "INSUFFICIENT_STOCK",
              message: `No hay stock suficiente de ${product.name}.`,
            });
          await tx.insert(stockMovements).values({
            productId,
            saleId: sale.id,
            type: "sale",
            delta: -quantity,
            balanceAfter: balance.quantity,
            createdByUserId: actorUserId,
          });
        }

        if (input.paymentMethod) {
          await tx
            .insert(payments)
            .values({
              saleId: sale.id,
              method: input.paymentMethod,
              amountArs: totalArs,
            });
        }

        const response: CloseSaleResponse = {
          saleId: sale.id,
          saleNumber: sale.saleNumber,
          status: "closed",
          totalArs,
          ...(member && pointsEarned !== undefined
            ? { pointsEarned, pointsSyncStatus: "pending" as const }
            : {}),
        };
        if (rule && this.club.sourceId) {
          const eventId = randomUUID();
          await this.club.enqueue(tx, {
            schemaVersion: 1,
            eventId,
            sourceId: this.club.sourceId,
            saleId: sale.id,
            saleVersion: 1,
            occurredAt: closedAt.toISOString(),
            eventType: "sale.closed",
            saleNumber: sale.saleNumber,
            totalArs,
            closedAt: closedAt.toISOString(),
            memberId: member?.memberId ?? null,
            pointRuleVersion: rule.version,
            pesosPorPunto: rule.pesosPorPunto,
            pointsEarned: pointsEarned!,
            items: itemSnapshots.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              unitPriceArs: item.unitPriceArs,
              subtotalArs: item.subtotalArs,
            })),
          });
        }
        await this.audit.record(tx, {
          actorUserId,
          action: "sale.closed",
          entityType: "sale",
          entityId: sale.id,
          after: {
            totalArs,
            itemCount: input.items.length,
            paymentMethod: input.paymentMethod ?? null,
          },
        });
        return response;
      },
    );
  }

  async void(actorUserId: string, saleId: string, reason: string, key: string) {
    return writeOnce(
      this.db,
      actorUserId,
      "sales.void",
      key,
      { saleId, reason },
      async (tx) => {
        const voidedAt = new Date();
        const [sale] = await tx
          .update(sales)
          .set({
            status: "void",
            voidedByUserId: actorUserId,
            voidedAt,
            voidReason: reason.trim(),
            saleVersion: sql`${sales.saleVersion} + 1`,
            pointsSyncStatus: sql`case when ${sales.pointRuleVersion} is null then 'none' else 'pending' end`,
          })
          .where(and(eq(sales.id, saleId), eq(sales.status, "closed")))
          .returning();
        if (!sale) {
          const [existing] = await tx
            .select({ id: sales.id })
            .from(sales)
            .where(eq(sales.id, saleId));
          if (!existing)
            throw new NotFoundException("No encontramos esa venta.");
          throw new ConflictException({
            code: "SALE_ALREADY_VOID",
            message: "La venta ya está anulada.",
          });
        }

        const items = await tx
          .select()
          .from(saleItems)
          .where(eq(saleItems.saleId, saleId));
        const quantities = new Map<string, number>();
        for (const item of items) {
          if (item.tracksStock)
            quantities.set(
              item.productId,
              (quantities.get(item.productId) ?? 0) + item.quantity,
            );
        }

        for (const [productId, quantity] of [...quantities].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          const [balance] = await tx
            .update(inventoryBalances)
            .set({
              quantity: sql`${inventoryBalances.quantity} + ${quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(inventoryBalances.productId, productId))
            .returning();
          if (!balance)
            throw new ConflictException(
              "Falta el saldo de inventario del producto vendido.",
            );
          await tx.insert(stockMovements).values({
            productId,
            saleId,
            type: "sale_reversal",
            delta: quantity,
            balanceAfter: balance.quantity,
            reason: `Anulación: ${reason.trim()}`,
            createdByUserId: actorUserId,
          });
        }

        await tx
          .update(payments)
          .set({
            status: "refunded",
            refundedAt: new Date(),
            refundedByUserId: actorUserId,
          })
          .where(eq(payments.saleId, saleId));
        await this.audit.record(tx, {
          actorUserId,
          action: "sale.voided",
          entityType: "sale",
          entityId: saleId,
          reason: reason.trim(),
          before: { status: "closed", totalArs: sale.totalArs },
          after: { status: "void" },
        });
        if (sale.pointRuleVersion && this.club.sourceId)
          await this.club.enqueue(tx, {
            schemaVersion: 1,
            eventId: randomUUID(),
            sourceId: this.club.sourceId,
            saleId,
            saleVersion: sale.saleVersion,
            occurredAt: voidedAt.toISOString(),
            eventType: "sale.voided",
          });
        return { saleId, status: "void" as const };
      },
    );
  }

  async attachMember(
    actorUserId: string,
    saleId: string,
    memberNumber: string,
    key: string,
  ) {
    return writeOnce(
      this.db,
      actorUserId,
      "sales.attach-member",
      key,
      { saleId, memberNumber },
      async (tx) => {
        if (!this.club.configured || !this.club.sourceId)
          throw new ServiceUnavailableException("El club aún no está configurado.");
        const [sale] = await tx
          .select()
          .from(sales)
          .where(eq(sales.id, saleId))
          .for("update");
        if (!sale) throw new NotFoundException("No encontramos esa venta.");
        if (sale.status !== "closed" || sale.memberId)
          throw new ConflictException({
            code: "SALE_NOT_ATTACHABLE",
            message: "La venta ya fue anulada o asociada a un socio.",
          });
        if (Date.now() >= sale.createdAt.getTime() + 24 * 3600000)
          throw new ConflictException({
            code: "ATTACHMENT_EXPIRED",
            message: "Pasaron las 24 horas para asociar esta venta.",
          });
        if (
          sale.pointRuleVersion === null ||
          sale.pesosPorPunto === null ||
          sale.pointsEarned === null
        )
          throw new ConflictException({
            code: "POINT_RULE_UNAVAILABLE",
            message: "Esta venta se cerró antes de activar el club.",
          });
        const member = await this.club.cachedActiveMember(tx, memberNumber);
        if (!member)
          throw new ConflictException({
            code: "MEMBER_NOT_READY",
            message: "Buscá y confirmá el socio antes de asociarlo.",
          });
        const attachedAt = new Date();
        await tx
          .update(sales)
          .set({
            memberId: member.memberId,
            memberNumber: member.memberNumber,
            memberAttachedAt: attachedAt,
            memberAttachedByUserId: actorUserId,
            pointsSyncStatus: "pending",
            saleVersion: 2,
          })
          .where(and(eq(sales.id, saleId), isNull(sales.memberId)));
        await this.club.enqueue(tx, {
          schemaVersion: 1,
          eventId: randomUUID(),
          sourceId: this.club.sourceId,
          saleId,
          saleVersion: 2,
          occurredAt: attachedAt.toISOString(),
          eventType: "sale.member_attached",
          memberId: member.memberId,
        });
        await this.audit.record(tx, {
          actorUserId,
          action: "sale.member_attached",
          entityType: "sale",
          entityId: saleId,
          after: { memberNumberLast4: memberNumber.slice(-4) },
        });
        return {
          saleId,
          memberNumberLast4: memberNumber.slice(-4),
          pointsEarned: sale.pointsEarned,
          pointsSyncStatus: "pending" as const,
        };
      },
    );
  }
}
