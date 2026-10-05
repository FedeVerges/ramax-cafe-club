import type { CloseSaleInput } from "../../../../../../packages/contracts/src";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsBoolean,
  IsUUID,
  Min,
  ValidateNested,
  Max,
} from "class-validator";

const PAYMENT_METHODS = ["cash", "transfer"] as const;

export class SaleItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Max(2147483647)
  @Min(1)
  quantity!: number;
}

export class CloseSaleDto implements CloseSaleInput {
  @IsInt() @Max(2147483647) @Min(1) expectedTotalArs!: number;
  @IsOptional() @IsBoolean() transferConfirmed?: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];
}
