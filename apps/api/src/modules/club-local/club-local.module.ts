import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ClubLocalController } from "./club-local.controller";
import { ClubLocalService } from "./club-local.service";
import { ClubAdminController } from "./club-admin.controller";

@Module({
  imports: [AuthModule],
  controllers: [ClubLocalController, ClubAdminController],
  providers: [ClubLocalService],
  exports: [ClubLocalService],
})
export class ClubLocalModule {}
