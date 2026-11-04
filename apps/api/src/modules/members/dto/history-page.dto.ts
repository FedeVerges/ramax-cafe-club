import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class HistoryPageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
}
