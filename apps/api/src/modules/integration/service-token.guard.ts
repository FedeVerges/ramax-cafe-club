import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(config: ConfigService) {
    const token = config.getOrThrow<string>("CLUB_SERVICE_TOKEN");
    if (token.length < 32)
      throw new Error("CLUB_SERVICE_TOKEN debe tener al menos 32 caracteres.");
    this.expected = createHash("sha256").update(token).digest();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new UnauthorizedException("Falta la credencial de integración.");
    const candidate = createHash("sha256").update(header.slice(7)).digest();
    if (!timingSafeEqual(candidate, this.expected))
      throw new UnauthorizedException("Credencial de integración inválida.");
    return true;
  }
}
