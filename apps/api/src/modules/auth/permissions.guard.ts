import { CanActivate, ForbiddenException, Injectable, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "../../common/auth-user";
import { REQUIRED_PERMISSIONS } from "../../common/require-permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    if (required.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (required.every((permission) => request.ramaxUser?.permissions.includes(permission))) return true;
    throw new ForbiddenException("No tenés permiso para realizar esta acción.");
  }
}
