import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsUUID, Min, ValidateNested } from "class-validator";

const PAYMENT_METHODS = ["cash", "transfer", "mercado_pago", "card", "other"] as const;

export class SaleItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CloseSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];
}
