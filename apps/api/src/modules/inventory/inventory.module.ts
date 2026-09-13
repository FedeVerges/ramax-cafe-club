import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ProductsModule } from "../products/products.module";
import { AuthModule } from "../auth/auth.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({ imports: [ProductsModule, AuditModule, AuthModule], controllers: [InventoryController], providers: [InventoryService], exports: [InventoryService] })
export class InventoryModule {}
