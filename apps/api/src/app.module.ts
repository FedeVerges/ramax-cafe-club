import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "./database/database.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CampaignsModule } from "./modules/campaigns/campaigns.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { MembersModule } from "./modules/members/members.module";
import { PointsModule } from "./modules/points/points.module";
import { ProductsModule } from "./modules/products/products.module";
import { RedemptionsModule } from "./modules/redemptions/redemptions.module";
import { RewardsModule } from "./modules/rewards/rewards.module";
import { SalesModule } from "./modules/sales/sales.module";
import { UsersAndRolesModule } from "./modules/users-and-roles/users-and-roles.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    UsersAndRolesModule,
    MembersModule,
    ProductsModule,
    InventoryModule,
    PointsModule,
    RewardsModule,
    SalesModule,
    RedemptionsModule,
    CampaignsModule,
    AuthModule,
  ],
})
export class AppModule {}
