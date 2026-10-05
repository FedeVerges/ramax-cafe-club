import { Transform } from "class-transformer";
import { IsString, MinLength, MaxLength, Matches } from "class-validator";
export class LoginDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9._@-]+$/)
  @MaxLength(320)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
