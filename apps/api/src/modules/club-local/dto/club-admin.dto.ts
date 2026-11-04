import { Type } from "class-transformer";
import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength, NotEquals } from "class-validator";

export class SetLocalPointRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pesosPorPunto!: number;
}

export class LocalMemberStatusDto {
  @IsIn(["active", "suspended"])
  status!: "active" | "suspended";

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class LocalPointAdjustmentDto {
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  @Min(-2147483647)
  @Max(2147483647)
  delta!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
