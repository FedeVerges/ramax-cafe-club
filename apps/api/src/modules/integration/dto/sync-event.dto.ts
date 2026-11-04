import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsString,
  MaxLength,
} from "class-validator";

export class SyncSaleItemDto {
  @IsString()
  @MaxLength(160)
  productName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPriceArs!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotalArs!: number;
}

export class SyncEventDto {
  @IsInt()
  @IsIn([1])
  schemaVersion!: 1;

  @IsUUID()
  eventId!: string;

  @IsUUID()
  sourceId!: string;

  @IsUUID()
  saleId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  saleVersion!: number;

  @IsDateString()
  occurredAt!: string;

  @IsIn(["sale.closed", "sale.member_attached", "sale.voided"])
  eventType!: "sale.closed" | "sale.member_attached" | "sale.voided";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  saleNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  totalArs?: number;

  @IsOptional()
  @IsDateString()
  closedAt?: string;

  @IsOptional()
  @IsUUID()
  memberId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pointRuleVersion?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pesosPorPunto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pointsEarned?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncSaleItemDto)
  items?: SyncSaleItemDto[];
}
