import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PointsModule } from "../points/points.module";
import { ProductsModule } from "../products/products.module";

@Module({ imports: [ProductsModule, InventoryModule, PointsModule, AuditModule] })
export class RewardsModule {}
