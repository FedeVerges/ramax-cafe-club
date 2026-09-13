import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ilike, or } from "drizzle-orm";
import { inventoryBalances, products, stockMovements } from "../../../../../db/schema";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import { AuditService } from "../audit/audit.service";
import { Inject } from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(@Inject(DATABASE) private readonly db: Database, private readonly audit: AuditService) {}

  async list(search?: string) {
    const filter = search
      ? or(ilike(products.name, `%${search}%`), ilike(products.sku, `%${search}%`))
      : undefined;

    return this.db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        category: products.category,
        description: products.description,
        priceArs: products.priceArs,
        tracksStock: products.tracksStock,
        status: products.status,
        quantity: inventoryBalances.quantity,
        minimumQuantity: inventoryBalances.minimumQuantity,
      })
      .from(products)
      .innerJoin(inventoryBalances, eq(inventoryBalances.productId, products.id))
      .where(filter)
      .orderBy(products.name);
  }

  async create(actorUserId: string, input: CreateProductDto) {
    try {
      return await this.db.transaction(async (tx) => {
        const [product] = await tx
          .insert(products)
          .values({
            sku: input.sku?.trim() || null,
            name: input.name.trim(),
            category: input.category?.trim() || null,
            description: input.description?.trim() || null,
            priceArs: input.priceArs,
            tracksStock: input.tracksStock,
          })
          .returning();
        if (!product) throw new ConflictException("No se pudo crear el producto.");

        await tx.insert(inventoryBalances).values({
          productId: product.id,
          quantity: input.initialQuantity,
          minimumQuantity: input.minimumQuantity,
        });

        if (input.initialQuantity > 0) {
          await tx.insert(stockMovements).values({
            productId: product.id,
            type: "opening",
            delta: input.initialQuantity,
            balanceAfter: input.initialQuantity,
            reason: "Stock inicial",
            createdByUserId: actorUserId,
          });
        }

        await this.audit.record(tx, {
          actorUserId,
          action: "product.created",
          entityType: "product",
          entityId: product.id,
          after: { name: product.name, sku: product.sku, priceArs: product.priceArs, initialQuantity: input.initialQuantity },
        });

        return product;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("El SKU ya existe.");
      throw error;
    }
  }

  async update(actorUserId: string, productId: string, input: UpdateProductDto) {
    const [current] = await this.db.select().from(products).where(eq(products.id, productId));
    if (!current) throw new NotFoundException("No encontramos ese producto.");

    try {
      const [updated] = await this.db
        .update(products)
        .set({
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.sku === undefined ? {} : { sku: input.sku.trim() || null }),
          ...(input.category === undefined ? {} : { category: input.category.trim() || null }),
          ...(input.description === undefined ? {} : { description: input.description.trim() || null }),
          ...(input.priceArs === undefined ? {} : { priceArs: input.priceArs }),
          ...(input.tracksStock === undefined ? {} : { tracksStock: input.tracksStock }),
          ...(input.active === undefined ? {} : { status: input.active ? "active" : "inactive" }),
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId))
        .returning();
      if (!updated) throw new NotFoundException("No encontramos ese producto.");

      await this.audit.record(this.db, {
        actorUserId,
        action: "product.updated",
        entityType: "product",
        entityId: productId,
        before: { name: current.name, sku: current.sku, priceArs: current.priceArs, status: current.status },
        after: { name: updated.name, sku: updated.sku, priceArs: updated.priceArs, status: updated.status },
      });
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("El SKU ya existe.");
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
