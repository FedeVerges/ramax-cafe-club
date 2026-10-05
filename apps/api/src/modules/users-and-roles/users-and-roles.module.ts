import { AuthModule } from "../auth/auth.module";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class UsersAndRolesModule {}
