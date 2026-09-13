import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from "class-validator";

export class AdjustInventoryDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @ValidateIf((value: AdjustInventoryDto) => value.delta !== 0)
  delta!: number;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsBoolean()
  allowNegative = false;
}
