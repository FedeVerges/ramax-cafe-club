import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { cloudSales, memberSessions, members } from "../../../../../db/cloud-schema";
import { CLOUD_DATABASE } from "../../cloud-database/cloud-database.module";
import type { CloudDatabase } from "../../cloud-database/cloud-database.types";

const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class MembersService {
  private readonly google: OAuth2Client;
  private readonly clientId: string;
  private readonly pilotAccessCode: string | undefined;

  constructor(
    @Inject(CLOUD_DATABASE) private readonly db: CloudDatabase,
    config: ConfigService,
  ) {
    this.clientId = config.getOrThrow<string>("GOOGLE_CLIENT_ID");
    this.google = new OAuth2Client(this.clientId);
    if (config.get<string>("PILOT_MEMBER_LOGIN_ENABLED") === "true") {
      const accessCode = config.get<string>("PILOT_MEMBER_ACCESS_CODE");
      if (!accessCode || accessCode.length < 24)
        throw new Error("PILOT_MEMBER_ACCESS_CODE debe tener al menos 24 caracteres.");
      this.pilotAccessCode = accessCode;
    }
  }

  pilotLoginAvailable(): boolean {
    return Boolean(this.pilotAccessCode);
  }

  async loginWithPilotCode(code: string) {
    if (!this.pilotAccessCode)
      throw new UnauthorizedException("El acceso de prueba no está habilitado.");
    const submitted = createHash("sha256").update(code).digest();
    const expected = createHash("sha256").update(this.pilotAccessCode).digest();
    if (!timingSafeEqual(submitted, expected))
      throw new UnauthorizedException("Código de prueba incorrecto.");
    const member = await this.findOrCreate({
      sub: "pilot:member:1",
      email: "socio.piloto@ramax.invalid",
      displayName: "Socio de prueba",
    });
    if (member.status !== "active")
      throw new UnauthorizedException("La membresía no está activa.");
    return this.createSession(member);
  }

  async loginWithGoogle(credential: string) {
    let payload;
    try {
      const ticket = await this.google.verifyIdToken({
        idToken: credential,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException("No pudimos verificar la cuenta Google.");
    }
    if (!payload?.sub || !payload.email || !payload.email_verified)
      throw new UnauthorizedException("La cuenta Google no tiene email verificado.");

    const member = await this.findOrCreate({
      sub: payload.sub,
      email: payload.email,
      displayName: payload.name?.trim() || payload.email,
    });
    if (member.status !== "active")
      throw new UnauthorizedException("La membresía no está activa.");

    return this.createSession(member);
  }

  private async createSession(member: typeof members.$inferSelect) {
    const token = randomBytes(32).toString("base64url");
    await this.db.insert(memberSessions).values({
      memberId: member.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
    });
    return { token, member: this.publicProfile(member) };
  }

  private async findOrCreate(identity: {
    sub: string;
    email: string;
    displayName: string;
  }) {
    const [existing] = await this.db
      .select()
      .from(members)
      .where(eq(members.googleSub, identity.sub));
    if (existing) return existing;

    for (let attempt = 0; attempt < 25; attempt++) {
      const memberNumber = String(randomInt(1_000_000)).padStart(6, "0");
      const [created] = await this.db
        .insert(members)
        .values({
          memberNumber,
          googleSub: identity.sub,
          displayName: identity.displayName,
          email: identity.email,
        })
        .onConflictDoNothing()
        .returning();
      if (created) return created;
      const [concurrent] = await this.db
        .select()
        .from(members)
        .where(eq(members.googleSub, identity.sub));
      if (concurrent) return concurrent;
    }
    throw new ConflictException("No pudimos asignar un número de socio.");
  }

  async fromToken(token?: string) {
    if (!token) return undefined;
    const [row] = await this.db
      .select({ member: members })
      .from(memberSessions)
      .innerJoin(members, eq(memberSessions.memberId, members.id))
      .where(
        and(
          eq(memberSessions.tokenHash, hashToken(token)),
          isNull(memberSessions.revokedAt),
          gt(memberSessions.expiresAt, new Date()),
          eq(members.status, "active"),
        ),
      );
    return row?.member;
  }

  async logout(token?: string): Promise<void> {
    if (!token) return;
    await this.db
      .update(memberSessions)
      .set({ revokedAt: new Date() })
      .where(eq(memberSessions.tokenHash, hashToken(token)));
  }

  async updatePhone(memberId: string, phone: string | null) {
    const [updated] = await this.db
      .update(members)
      .set({ phone, updatedAt: new Date() })
      .where(and(eq(members.id, memberId), eq(members.status, "active")))
      .returning();
    if (!updated) throw new UnauthorizedException("La membresía no está activa.");
    return this.publicProfile(updated);
  }

  async purchases(memberId: string, page = 1) {
    const rows = await this.db
      .select({
        saleId: cloudSales.saleId,
        saleNumber: cloudSales.saleNumber,
        totalArs: cloudSales.totalArs,
        items: cloudSales.items,
        pointsEarned: cloudSales.pointsEarned,
        status: cloudSales.status,
        closedAt: cloudSales.closedAt,
      })
      .from(cloudSales)
      .where(eq(cloudSales.memberId, memberId))
      .orderBy(desc(cloudSales.closedAt), desc(cloudSales.saleId))
      .limit(26)
      .offset((page - 1) * 25);
    return { items: rows.slice(0, 25), hasMore: rows.length > 25 };
  }

  publicProfile(member: typeof members.$inferSelect) {
    return {
      id: member.id,
      memberNumber: member.memberNumber,
      displayName: member.displayName,
      email: member.email,
      phone: member.phone,
      status: member.status,
      accessMethod: member.googleSub?.startsWith("pilot:") ? "pilot" : "google",
    };
  }
}
