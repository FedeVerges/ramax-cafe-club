import {
  Headers,
  ParseUUIDPipe,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
  Param,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/current-user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { SessionGuard } from "../auth/session.guard";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("products")
@UseGuards(SessionGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions("products.read")
  list(@Query("search") search?: string) {
    return this.productsService.list(search);
  }

  @Post()
  @RequirePermissions("products.manage")
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateProductDto,
    @Headers("idempotency-key") key: string,
  ) {
    return this.productsService.create(user.id, body, key);
  }

  @Patch(":id")
  @RequirePermissions("products.manage")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) productId: string,
    @Body() body: UpdateProductDto,
    @Headers("idempotency-key") key: string,
  ) {
    return this.productsService.update(user.id, productId, body, key);
  }
}
