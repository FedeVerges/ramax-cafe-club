import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class GoogleCredentialDto {
  @IsString()
  @MinLength(100)
  credential!: string;
}

export class PilotAccessDto {
  @IsString()
  @MinLength(1)
  code!: string;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^\+?[0-9 ()-]{6,40}$/)
  phone?: string | null;
}
