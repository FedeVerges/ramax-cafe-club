import type { AdjustInventoryInput } from "../../../../../../packages/contracts/src";
import { Transform } from "class-transformer";
import {
  IsInt,
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
  IsOptional,
  Max,
  Min,
  NotEquals,
} from "class-validator";
export class AdjustInventoryDto implements AdjustInventoryInput {
  @IsUUID() productId!: string;
  @IsInt() @Min(-2147483647) @Max(2147483647) @NotEquals(0) delta!: number;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class InventoryQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;
}
