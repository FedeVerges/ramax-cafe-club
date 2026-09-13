import { Body, Controller, Get, NotImplementedException, Post, Res, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { SESSION_COOKIE } from "./session.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("me")
  @ApiOperation({ summary: "Consulta la sesión actual" })
  async me(@Res({ passthrough: true }) response: Response): Promise<{ authenticated: false } | { authenticated: true; user: unknown; homePath: string }> {
    const token = response.req.cookies?.[SESSION_COOKIE];
    const user = await this.authService.sessionFromToken(token);
    if (!user) return { authenticated: false };
    const homePath = user.primaryRole === "admin" ? "/admin" : user.primaryRole === "employee" ? "/operacion" : "/club";
    return { authenticated: true, user, homePath };
  }

  @Get("google")
  @ApiOperation({ summary: "Inicia Google OAuth" })
  googleLogin(): never {
    throw new NotImplementedException("Google OAuth se configura al cargar las credenciales del entorno.");
  }

  @Post("login")
  @ApiOperation({ summary: "Inicia sesión de personal" })
  async staffLogin(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response): Promise<{ authenticated: true; user: unknown; homePath: string }> {
    const { token, session } = await this.authService.login(body.email, body.password);
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000,
      path: "/",
    });
    return { authenticated: true, user: session, homePath: session.homePath };
  }

  @Post("logout")
  @ApiOperation({ summary: "Cierra la sesión actual" })
  async logout(@Res({ passthrough: true }) response: Response): Promise<void> {
    await this.authService.logout(response.req.cookies?.[SESSION_COOKIE]);
    response.clearCookie(SESSION_COOKIE, { path: "/" });
  }
}
