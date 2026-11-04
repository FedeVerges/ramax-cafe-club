import { Matches } from "class-validator";
import type { AttachMemberInput } from "../../../../../../packages/contracts/src";

export class AttachMemberDto implements AttachMemberInput {
  @Matches(/^[0-9]{6}$/)
  memberNumber!: string;
}
