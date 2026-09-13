import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { MembersModule } from "../members/members.module";
import { PointsModule } from "../points/points.module";
import { RewardsModule } from "../rewards/rewards.module";

@Module({ imports: [RewardsModule, PointsModule, MembersModule, AuditModule] })
export class RedemptionsModule {}
