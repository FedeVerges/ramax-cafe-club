import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { MembersModule } from "../members/members.module";

@Module({ imports: [MembersModule, AuditModule] })
export class PointsModule {}
