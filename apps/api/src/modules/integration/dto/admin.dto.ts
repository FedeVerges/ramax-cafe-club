import { Type } from "class-transformer";
import { IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength, NotEquals } from "class-validator";

export class SetPointRuleDto {
  @IsUUID()
  actorStaffId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pesosPorPunto!: number;
}

export class ChangeMemberStatusDto {
  @IsUUID()
  actorStaffId!: string;

  @IsIn(["active", "suspended"])
  status!: "active" | "suspended";

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class AdjustPointsDto {
  @IsUUID()
  actorStaffId!: string;

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
