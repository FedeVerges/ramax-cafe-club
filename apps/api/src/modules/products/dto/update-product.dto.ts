import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  priceArs?: number;

  @IsOptional()
  @IsBoolean()
  tracksStock?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
