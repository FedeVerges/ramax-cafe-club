import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { members } from "../../../../../db/cloud-schema";
import { MembersService } from "./members.service";

export const MEMBER_SESSION_COOKIE = "ramax_member_session";

export type MemberRequest = Request & {
  ramaxMember?: typeof members.$inferSelect;
};

@Injectable()
export class MemberSessionGuard implements CanActivate {
  constructor(private readonly membersService: MembersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MemberRequest>();
    const member = await this.membersService.fromToken(
      request.cookies?.[MEMBER_SESSION_COOKIE],
    );
    if (!member) throw new UnauthorizedException("Ingresá al club para continuar.");
    request.ramaxMember = member;
    return true;
  }
}
