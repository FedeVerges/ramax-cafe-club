import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PermissionsGuard } from "./permissions.guard";
import { SessionGuard } from "./session.guard";

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, PermissionsGuard],
  exports: [AuthService, SessionGuard, PermissionsGuard],
})
export class AuthModule {}
