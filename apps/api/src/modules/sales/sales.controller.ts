import { SaleQueryDto } from "./dto/sale-query.dto";
import {
  Query,
  ParseUUIDPipe,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
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
  list(@Query() query: SaleQueryDto) {
    return this.salesService.list(query);
  }

  @Post()
  @RequirePermissions("sales.create")
  close(
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") idempotencyKey: string,
    @Body() body: CloseSaleDto,
  ) {
    return this.salesService.close(user.id, idempotencyKey, body);
  }

  @Get(":id")
  @RequirePermissions("sales.read")
  detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.salesService.detail(id);
  }

  @Get(":id/receipt")
  @RequirePermissions("sales.read")
  receipt(@Param("id", ParseUUIDPipe) id: string) {
    return this.salesService.detail(id);
  }

  @Post(":id/void")
  @RequirePermissions("sales.void")
  void(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) saleId: string,
    @Body() body: VoidSaleDto,
    @Headers("idempotency-key") key: string,
  ) {
    return this.salesService.void(user.id, saleId, body.reason, key);
  }
}
