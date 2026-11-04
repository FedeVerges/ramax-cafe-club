import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { GoogleCredentialDto, PilotAccessDto, UpdateMemberDto } from "./dto/member.dto";
import { HistoryPageDto } from "./dto/history-page.dto";
import {
  MEMBER_SESSION_COOKIE,
  MemberSessionGuard,
  type MemberRequest,
} from "./member-session.guard";
import { MembersService } from "./members.service";

const CSRF_COOKIE = "ramax_member_csrf";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function validCsrf(cookie?: string, header?: string): boolean {
  if (!cookie || !header) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Controller("club")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get("auth/csrf")
  csrf(@Res({ passthrough: true }) response: Response) {
    const token = randomBytes(32).toString("base64url");
    response.cookie(CSRF_COOKIE, token, COOKIE_OPTIONS);
    return { csrfToken: token };
  }

  @Post("auth/google")
  async login(
    @Body() body: GoogleCredentialDto,
    @Headers("x-csrf-token") csrf: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!validCsrf(request.cookies?.[CSRF_COOKIE], csrf))
      throw new UnauthorizedException("La sesión de acceso venció. Reintentá.");
    const { token, member } = await this.membersService.loginWithGoogle(
      body.credential,
    );
    response.cookie(MEMBER_SESSION_COOKIE, token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 86400000,
    });
    return { authenticated: true, member };
  }

  @Get("auth/methods")
  methods() {
    return { pilot: this.membersService.pilotLoginAvailable() };
  }

  @Post("auth/pilot")
  async pilotLogin(
    @Body() body: PilotAccessDto,
    @Headers("x-csrf-token") csrf: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!validCsrf(request.cookies?.[CSRF_COOKIE], csrf))
      throw new UnauthorizedException("La sesión de acceso venció. Reintentá.");
    const { token, member } = await this.membersService.loginWithPilotCode(body.code);
    response.cookie(MEMBER_SESSION_COOKIE, token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 86400000,
    });
    return { authenticated: true, member };
  }

  @Get("auth/me")
  async session(@Req() request: Request) {
    const member = await this.membersService.fromToken(
      request.cookies?.[MEMBER_SESSION_COOKIE],
    );
    return member
      ? { authenticated: true, member: this.membersService.publicProfile(member) }
      : { authenticated: false };
  }

  @Post("auth/logout")
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Headers("x-csrf-token") csrf: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!validCsrf(request.cookies?.[CSRF_COOKIE], csrf))
      throw new UnauthorizedException("La sesión de acceso venció. Reintentá.");
    await this.membersService.logout(request.cookies?.[MEMBER_SESSION_COOKIE]);
    response.clearCookie(MEMBER_SESSION_COOKIE, { path: "/" });
  }

  @Get("me")
  @UseGuards(MemberSessionGuard)
  me(@Req() request: MemberRequest) {
    return this.membersService.publicProfile(request.ramaxMember!);
  }

  @Patch("me")
  @UseGuards(MemberSessionGuard)
  update(
    @Req() request: MemberRequest,
    @Headers("x-csrf-token") csrf: string,
    @Body() body: UpdateMemberDto,
  ) {
    if (!validCsrf(request.cookies?.[CSRF_COOKIE], csrf))
      throw new UnauthorizedException("La sesión de acceso venció. Reintentá.");
    return this.membersService.updatePhone(
      request.ramaxMember!.id,
      body.phone?.trim() || null,
    );
  }

  @Get("purchases")
  @UseGuards(MemberSessionGuard)
  purchases(@Req() request: MemberRequest, @Query() query: HistoryPageDto) {
    return this.membersService.purchases(request.ramaxMember!.id, query.page);
  }
}
