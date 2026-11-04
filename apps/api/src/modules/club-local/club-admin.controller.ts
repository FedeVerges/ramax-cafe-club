import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "../../common/auth-user";
import { CurrentUser } from "../../common/current-user.decorator";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { SessionGuard } from "../auth/session.guard";
import { ClubLocalService } from "./club-local.service";
import {
  LocalMemberStatusDto,
  LocalPointAdjustmentDto,
  SetLocalPointRuleDto,
} from "./dto/club-admin.dto";

@Controller("club-admin")
@UseGuards(SessionGuard, PermissionsGuard)
export class ClubAdminController {
  constructor(private readonly club: ClubLocalService) {}

  @Get("members")
  @RequirePermissions("members.manage")
  members() {
    return this.club.adminRequest("members");
  }

  @Get("members/:id")
  @RequirePermissions("members.manage", "points.manage")
  member(@Param("id", ParseUUIDPipe) id: string) {
    return this.club.adminRequest(`members/${id}`);
  }

  @Get("point-rule")
  @RequirePermissions("points.manage")
  rule() {
    return this.club.ruleStatus();
  }

  @Post("point-rule")
  @RequirePermissions("points.manage")
  async setRule(
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") key: string,
    @Body() body: SetLocalPointRuleDto,
  ) {
    const rule = await this.club.adminRequest<{
      version: number;
      pesosPorPunto: number;
      effectiveAt: string;
    }>("point-rule", { ...body, actorStaffId: user.id }, key);
    await this.club.rememberRule(rule);
    return rule;
  }

  @Post("members/:id/status")
  @RequirePermissions("members.manage")
  async status(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: LocalMemberStatusDto,
  ) {
    const result = await this.club.adminRequest<{ id: string; status: "active" | "suspended" }>(
      `members/${id}/status`,
      { ...body, actorStaffId: user.id },
      key,
    );
    await this.club.rememberMemberStatus(result.id, result.status);
    return result;
  }

  @Post("members/:id/points")
  @RequirePermissions("points.manage")
  async adjust(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: LocalPointAdjustmentDto,
  ) {
    const result = await this.club.adminRequest<{ memberId: string; confirmedBalance: number }>(
      `members/${id}/points`,
      { ...body, actorStaffId: user.id },
      key,
    );
    await this.club.rememberMemberBalance(result.memberId, result.confirmedBalance);
    return result;
  }
}
