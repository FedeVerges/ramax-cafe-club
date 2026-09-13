import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InventoryModule } from "../inventory/inventory.module";
import { MembersModule } from "../members/members.module";
import { PointsModule } from "../points/points.module";
import { ProductsModule } from "../products/products.module";
import { AuthModule } from "../auth/auth.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [ProductsModule, InventoryModule, MembersModule, PointsModule, AuditModule, AuthModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
