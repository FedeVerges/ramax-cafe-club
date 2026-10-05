import { Type } from "class-transformer";
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsIn,
  IsDateString,
} from "class-validator";
export class SaleQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) number?: number;
  @IsOptional() @IsIn(["closed", "void"]) status?: "closed" | "void";
  @IsOptional() @IsIn(["cash", "transfer"]) paymentMethod?: "cash" | "transfer";
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
