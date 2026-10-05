import {
  Headers,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../../common/auth-user";
import { CurrentUser } from "../../common/current-user.decorator";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { SessionGuard } from "../auth/session.guard";
import {
  AdjustInventoryDto,
  InventoryQueryDto,
} from "./dto/adjust-inventory.dto";
import { InventoryService } from "./inventory.service";

@ApiTags("inventory")
@Controller("inventory")
@UseGuards(SessionGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions("inventory.read")
  list() {
    return this.inventoryService.listLowStock();
  }

  @Get("movements")
  @RequirePermissions("inventory.read")
  movements(@Query() query: InventoryQueryDto) {
    return this.inventoryService.listMovements(query.productId);
  }

  @Post("adjustments")
  @RequirePermissions("inventory.adjust")
  adjust(
    @CurrentUser() user: AuthUser,
    @Body() body: AdjustInventoryDto,
    @Headers("idempotency-key") key: string,
  ) {
    return this.inventoryService.adjust(user.id, body, key);
  }
}
