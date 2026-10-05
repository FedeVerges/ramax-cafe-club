import type { VoidSaleInput } from "../../../../../../packages/contracts/src";
import { Transform } from "class-transformer";
import { IsString, MinLength, MaxLength, Equals } from "class-validator";
export class VoidSaleDto implements VoidSaleInput {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
  @Equals(true) refundConfirmed!: true;
}
