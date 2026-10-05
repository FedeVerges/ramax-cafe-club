import type { CreateProductInput } from "../../../../../../packages/contracts/src";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  Max,
} from "class-validator";

export class CreateProductDto implements CreateProductInput {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Max(2147483647)
  @Min(1)
  priceArs!: number;

  @IsOptional()
  @IsBoolean()
  tracksStock = true;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Max(2147483647)
  @Min(0)
  minimumQuantity = 0;
}
