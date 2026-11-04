import { Module } from "@nestjs/common";
import { MembersModule } from "../members/members.module";
import { PointsModule } from "../points/points.module";
import { IntegrationController } from "./integration.controller";
import { IntegrationService } from "./integration.service";
import { ServiceTokenGuard } from "./service-token.guard";
import { CloudAdminController } from "./admin.controller";
import { CloudAdminService } from "./admin.service";

@Module({
  imports: [MembersModule, PointsModule],
  controllers: [IntegrationController, CloudAdminController],
  providers: [IntegrationService, CloudAdminService, ServiceTokenGuard],
})
export class IntegrationModule {}
