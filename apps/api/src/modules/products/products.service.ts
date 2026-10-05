import { writeOnce } from "../../common/idempotency";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq, ilike, or } from "drizzle-orm";
import { inventoryBalances, products } from "../../../../../db/schema";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import { AuditService } from "../audit/audit.service";
import { Inject } from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(search?: string) {
    const filter = search
      ? or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`),
        )
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
      .innerJoin(
        inventoryBalances,
        eq(inventoryBalances.productId, products.id),
      )
      .where(filter)
      .orderBy(products.name);
  }

  async create(actorUserId: string, input: CreateProductDto, key: string) {
    try {
      return await writeOnce(
        this.db,
        actorUserId,
        "products.create",
        key,
        input,
        async (tx) => {
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
          if (!product)
            throw new ConflictException("No se pudo crear el producto.");

          await tx.insert(inventoryBalances).values({
            productId: product.id,
            quantity: 0,
            minimumQuantity: input.minimumQuantity,
          });

          await this.audit.record(tx, {
            actorUserId,
            action: "product.created",
            entityType: "product",
            entityId: product.id,
            after: {
              name: product.name,
              sku: product.sku,
              priceArs: product.priceArs,
              initialQuantity: 0,
            },
          });

          return {
            ...product,
            quantity: 0,
            minimumQuantity: input.minimumQuantity,
          };
        },
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException("El SKU ya existe.");
      throw error;
    }
  }

  async update(
    actorUserId: string,
    productId: string,
    input: UpdateProductDto,
    key: string,
  ) {
    return writeOnce(
      this.db,
      actorUserId,
      "products.update",
      key,
      { productId, ...input },
      async (tx) => {
        const [current] = await tx
          .select()
          .from(products)
          .where(eq(products.id, productId))
          .for("update");
        if (!current)
          throw new NotFoundException("No encontramos ese producto.");

        try {
          const [updated] = await tx
            .update(products)
            .set({
              ...(input.name === undefined ? {} : { name: input.name.trim() }),
              ...(input.sku === undefined
                ? {}
                : { sku: input.sku.trim() || null }),
              ...(input.category === undefined
                ? {}
                : { category: input.category.trim() || null }),
              ...(input.description === undefined
                ? {}
                : { description: input.description.trim() || null }),
              ...(input.priceArs === undefined
                ? {}
                : { priceArs: input.priceArs }),
              ...(input.tracksStock === undefined
                ? {}
                : { tracksStock: input.tracksStock }),
              ...(input.active === undefined
                ? {}
                : { status: input.active ? "active" : "inactive" }),
              updatedAt: new Date(),
            })
            .where(eq(products.id, productId))
            .returning();
          if (!updated)
            throw new NotFoundException("No encontramos ese producto.");

          await this.audit.record(tx, {
            actorUserId,
            action: "product.updated",
            entityType: "product",
            entityId: productId,
            before: {
              name: current.name,
              sku: current.sku,
              priceArs: current.priceArs,
              status: current.status,
            },
            after: {
              name: updated.name,
              sku: updated.sku,
              priceArs: updated.priceArs,
              status: updated.status,
            },
          });
          const [balance] = await tx
            .select()
            .from(inventoryBalances)
            .where(eq(inventoryBalances.productId, productId));
          return {
            ...updated,
            quantity: balance!.quantity,
            minimumQuantity: balance!.minimumQuantity,
          };
        } catch (error) {
          if (isUniqueViolation(error))
            throw new ConflictException("El SKU ya existe.");
          throw error;
        }
      },
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (
    ("code" in error && error.code === "23505") ||
    ("cause" in error && isUniqueViolation(error.cause))
  );
}
