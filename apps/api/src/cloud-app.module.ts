import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { CloudDatabaseModule } from "./cloud-database/cloud-database.module";
import { CloudHealthController } from "./cloud-health.controller";
import { MembersModule } from "./modules/members/members.module";
import { PointsModule } from "./modules/points/points.module";
import { IntegrationModule } from "./modules/integration/integration.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env.cloud", ".env.cloud"],
    }),
    ScheduleModule.forRoot(),
    CloudDatabaseModule,
    MembersModule,
    PointsModule,
    IntegrationModule,
  ],
  controllers: [CloudHealthController],
})
export class CloudAppModule {}
