import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { idempotencyKeys, inventoryBalances, payments, products, saleItems, sales, stockMovements } from "../../../../../db/schema";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import { AuditService } from "../audit/audit.service";
import { Inject } from "@nestjs/common";
import { CloseSaleDto } from "./dto/close-sale.dto";
import { buildSaleSnapshot, SaleRuleError } from "./sale-policy";

type CloseSaleResponse = { saleId: string; status: "closed"; totalArs: number };

@Injectable()
export class SalesService {
  constructor(@Inject(DATABASE) private readonly db: Database, private readonly audit: AuditService) {}

  list() {
    return this.db
      .select({ id: sales.id, status: sales.status, totalArs: sales.totalArs, createdAt: sales.createdAt, voidedAt: sales.voidedAt })
      .from(sales)
      .orderBy(desc(sales.createdAt));
  }

  async close(actorUserId: string, idempotencyKey: string, input: CloseSaleDto): Promise<CloseSaleResponse> {
    if (!idempotencyKey.trim()) throw new BadRequestException("Falta la clave de idempotencia del cobro.");
    try {
      return await this.db.transaction(async (tx) => {
        const [stored] = await tx
          .select({ response: idempotencyKeys.response })
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.scope, "sales.close"), eq(idempotencyKeys.key, idempotencyKey), eq(idempotencyKeys.actorUserId, actorUserId)));
        if (stored) return stored.response as CloseSaleResponse;

        const productIds = [...new Set(input.items.map((item) => item.productId))];
        const productRows = await tx.select().from(products).where(inArray(products.id, productIds));
        if (productRows.length !== productIds.length) throw new BadRequestException("Uno de los productos ya no existe.");
        let snapshot;
        try {
          snapshot = buildSaleSnapshot(input.items, productRows);
        } catch (error) {
          if (error instanceof SaleRuleError) throw new BadRequestException(error.message);
          throw error;
        }
        const { items: itemSnapshots, totalArs, stockQuantities: quantities } = snapshot;

        const [sale] = await tx.insert(sales).values({ totalArs, createdByUserId: actorUserId }).returning();
        if (!sale) throw new ConflictException("No se pudo cerrar la venta.");
        await tx.insert(saleItems).values(itemSnapshots.map((item) => ({ saleId: sale.id, ...item })));

        for (const [productId, quantity] of quantities) {
          const product = productRows.find((candidate) => candidate.id === productId)!;
          if (!product.tracksStock) continue;
          const [balance] = await tx
            .update(inventoryBalances)
            .set({ quantity: sql`${inventoryBalances.quantity} - ${quantity}`, updatedAt: new Date() })
            .where(and(eq(inventoryBalances.productId, productId), gte(inventoryBalances.quantity, quantity)))
            .returning();
          if (!balance) throw new BadRequestException(`No hay stock suficiente de ${product.name}.`);
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
          await tx.insert(payments).values({ saleId: sale.id, method: input.paymentMethod, amountArs: totalArs });
        }

        const response: CloseSaleResponse = { saleId: sale.id, status: "closed", totalArs };
        await this.audit.record(tx, {
          actorUserId,
          action: "sale.closed",
          entityType: "sale",
          entityId: sale.id,
          after: { totalArs, itemCount: input.items.length, paymentMethod: input.paymentMethod ?? null },
        });
        await tx.insert(idempotencyKeys).values({
          scope: "sales.close",
          key: idempotencyKey,
          actorUserId,
          response,
        });
        return response;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const [stored] = await this.db
          .select({ response: idempotencyKeys.response })
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.scope, "sales.close"), eq(idempotencyKeys.key, idempotencyKey), eq(idempotencyKeys.actorUserId, actorUserId)));
        if (stored) return stored.response as CloseSaleResponse;
      }
      throw error;
    }
  }

  async void(actorUserId: string, saleId: string, reason: string) {
    return this.db.transaction(async (tx) => {
      const [sale] = await tx
        .update(sales)
        .set({ status: "void", voidedByUserId: actorUserId, voidedAt: new Date(), voidReason: reason.trim() })
        .where(and(eq(sales.id, saleId), eq(sales.status, "closed")))
        .returning();
      if (!sale) {
        const [existing] = await tx.select({ id: sales.id }).from(sales).where(eq(sales.id, saleId));
        if (!existing) throw new NotFoundException("No encontramos esa venta.");
        throw new ConflictException("La venta ya está anulada.");
      }

      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
      const quantities = new Map<string, number>();
      for (const item of items) {
        if (item.tracksStock) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      }

      for (const [productId, quantity] of quantities) {
        const [balance] = await tx
          .update(inventoryBalances)
          .set({ quantity: sql`${inventoryBalances.quantity} + ${quantity}`, updatedAt: new Date() })
          .where(eq(inventoryBalances.productId, productId))
          .returning();
        if (!balance) throw new ConflictException("Falta el saldo de inventario del producto vendido.");
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
        .set({ status: "refunded", refundedAt: new Date(), refundedByUserId: actorUserId })
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
      return { saleId, status: "void" as const };
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
