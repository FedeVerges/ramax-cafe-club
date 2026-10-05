import { BackupsModule } from "./modules/backups/backups.module";
import { HealthController } from "./health.controller";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "./database/database.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ProductsModule } from "./modules/products/products.module";
import { SalesModule } from "./modules/sales/sales.module";
import { UsersAndRolesModule } from "./modules/users-and-roles/users-and-roles.module";
@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    UsersAndRolesModule,
    ProductsModule,
    InventoryModule,

    SalesModule,

    AuthModule,
    BackupsModule,
  ],
})
export class AppModule {}
