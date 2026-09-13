import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { MembersModule } from "../members/members.module";
import { PointsModule } from "../points/points.module";

@Module({ imports: [MembersModule, PointsModule, AuditModule] })
export class CampaignsModule {}
