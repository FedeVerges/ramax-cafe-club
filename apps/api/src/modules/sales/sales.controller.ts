import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../../common/auth-user";
import { CurrentUser } from "../../common/current-user.decorator";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { SessionGuard } from "../auth/session.guard";
import { CloseSaleDto } from "./dto/close-sale.dto";
import { VoidSaleDto } from "./dto/void-sale.dto";
import { SalesService } from "./sales.service";

@ApiTags("sales")
@Controller("sales")
@UseGuards(SessionGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermissions("sales.read")
  list() {
    return this.salesService.list();
  }

  @Post()
  @RequirePermissions("sales.create")
  close(@CurrentUser() user: AuthUser, @Headers("idempotency-key") idempotencyKey: string, @Body() body: CloseSaleDto) {
    return this.salesService.close(user.id, idempotencyKey, body);
  }

  @Post(":id/void")
  @RequirePermissions("sales.void")
  void(@CurrentUser() user: AuthUser, @Param("id") saleId: string, @Body() body: VoidSaleDto) {
    return this.salesService.void(user.id, saleId, body.reason);
  }
}
