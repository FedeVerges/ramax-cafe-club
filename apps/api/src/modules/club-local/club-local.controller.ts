import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { SessionGuard } from "../auth/session.guard";
import { ClubLocalService } from "./club-local.service";

@Controller("members")
@UseGuards(SessionGuard, PermissionsGuard)
export class ClubLocalController {
  constructor(private readonly club: ClubLocalService) {}

  @Get("by-number/:number")
  @RequirePermissions("members.read")
  lookup(@Param("number") number: string) {
    return this.club.lookup(number);
  }
}
