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
import { CurrentUser } from "../../common/current-user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { SessionGuard } from "../auth/session.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { StaffService } from "./staff.service";
import { CreateStaffDto, PasswordDto } from "./dto/staff.dto";
@Controller("staff")
@UseGuards(SessionGuard, PermissionsGuard)
@RequirePermissions("users.manage")
export class StaffController {
  constructor(private readonly staff: StaffService) {}
  @Get() list() {
    return this.staff.list();
  }
  @Post() create(
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") key: string,
    @Body() input: CreateStaffDto,
  ) {
    return this.staff.create(user.id, key, input);
  }
  @Post(":id/deactivate") deactivate(
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") key: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.staff.change(user.id, key, id);
  }
  @Post(":id/password") password(
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") key: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PasswordDto,
  ) {
    return this.staff.change(user.id, key, id, input.password);
  }
}
