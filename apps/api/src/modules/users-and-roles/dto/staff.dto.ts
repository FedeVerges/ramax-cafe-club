import type { CreateStaffInput } from "../../../../../../packages/contracts/src";
import { Transform } from "class-transformer";
import { IsIn, IsString, Matches, MaxLength, MinLength } from "class-validator";
export class PasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
export class CreateStaffDto extends PasswordDto implements CreateStaffInput {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9._@-]+$/)
  @MaxLength(320)
  username!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string;
  @IsIn(["employee", "admin"]) role!: "employee" | "admin";
}
