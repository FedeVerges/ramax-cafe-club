import {
  Body,
  Controller,
  Get,
  Headers,
  Module,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CurrentUser } from "../../common/current-user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { SessionGuard } from "../auth/session.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { BackupsService } from "./backups.service";
import { RestoreDto } from "./restore.dto";
@Controller("backups")
@UseGuards(SessionGuard, PermissionsGuard)
@RequirePermissions("backups.manage")
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}
  @Get() list() {
    return this.backups.list();
  }
  @Post("restore") restore(
    @CurrentUser() actor: AuthUser,
    @Headers("idempotency-key") key: string,
    @Body() body: RestoreDto,
  ) {
    return this.backups.restore(actor, key, body);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [BackupsController],
  providers: [BackupsService],
})
export class BackupsModule {}
