import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { inventoryBalances, products, stockMovements } from "../../../../../db/schema";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import { AuditService } from "../audit/audit.service";
import { Inject } from "@nestjs/common";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";

@Injectable()
export class InventoryService {
  constructor(@Inject(DATABASE) private readonly db: Database, private readonly audit: AuditService) {}

  listLowStock() {
    return this.db
      .select({
        productId: products.id,
        productName: products.name,
        sku: products.sku,
        quantity: inventoryBalances.quantity,
        minimumQuantity: inventoryBalances.minimumQuantity,
      })
      .from(inventoryBalances)
      .innerJoin(products, eq(products.id, inventoryBalances.productId))
      .orderBy(products.name);
  }

  listMovements(productId?: string) {
    return this.db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        productName: products.name,
        type: stockMovements.type,
        delta: stockMovements.delta,
        balanceAfter: stockMovements.balanceAfter,
        reason: stockMovements.reason,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .where(productId ? eq(stockMovements.productId, productId) : undefined)
      .orderBy(desc(stockMovements.createdAt));
  }

  async adjust(actorUserId: string, input: AdjustInventoryDto) {
    if (input.delta === 0) throw new BadRequestException("El ajuste debe cambiar el stock.");

    return this.db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, input.productId));
      if (!product) throw new NotFoundException("No encontramos ese producto.");
      if (!product.tracksStock) throw new BadRequestException("Este producto no controla stock.");

      const condition = input.delta < 0 && !input.allowNegative
        ? and(eq(inventoryBalances.productId, input.productId), gte(inventoryBalances.quantity, Math.abs(input.delta)))
        : eq(inventoryBalances.productId, input.productId);
      const [balance] = await tx
        .update(inventoryBalances)
        .set({ quantity: sql`${inventoryBalances.quantity} + ${input.delta}`, updatedAt: new Date() })
        .where(condition)
        .returning();

      if (!balance) throw new BadRequestException("El ajuste dejaría el stock en negativo.");
      if (balance.quantity < 0 && !input.allowNegative) throw new BadRequestException("El ajuste dejaría el stock en negativo.");

      await tx.insert(stockMovements).values({
        productId: input.productId,
        type: "adjustment",
        delta: input.delta,
        balanceAfter: balance.quantity,
        reason: input.reason.trim(),
        createdByUserId: actorUserId,
      });
      await this.audit.record(tx, {
        actorUserId,
        action: "inventory.adjusted",
        entityType: "product",
        entityId: input.productId,
        reason: input.reason.trim(),
        after: { delta: input.delta, quantity: balance.quantity, allowNegative: input.allowNegative },
      });
      return { productId: input.productId, quantity: balance.quantity };
    });
  }
}
