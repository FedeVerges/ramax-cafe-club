import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest, AuthUser } from "./auth-user";

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthUser => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.ramaxUser!;
});
