import { Equals, IsUUID } from "class-validator";
import type { RestoreBackupInput } from "../../../../../packages/contracts/src";
export class RestoreDto implements RestoreBackupInput {
  @IsUUID() backupId!: string;
  @Equals(true) confirmed!: true;
}
