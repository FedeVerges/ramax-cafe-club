import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateProductDto {
  @IsString()
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
  @Min(1)
  priceArs!: number;

  @IsOptional()
  @IsBoolean()
  tracksStock = true;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  initialQuantity = 0;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  minimumQuantity = 0;
}
