import { CanActivate, Injectable, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/auth-user";
import { AuthService } from "./auth.service";

export const SESSION_COOKIE = "ramax_session";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authService.sessionFromToken(request.cookies?.[SESSION_COOKIE]);
    if (!user) throw new UnauthorizedException("Iniciá sesión para continuar.");
    request.ramaxUser = user;
    return true;
  }
}
