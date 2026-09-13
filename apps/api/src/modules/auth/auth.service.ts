import { Injectable, UnauthorizedException } from "@nestjs/common";
import { and, eq, gt, isNull } from "drizzle-orm";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { internalCredentials, permissions, rolePermissions, roles, sessions, userRoles, users } from "../../../../../db/schema";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import type { AuthUser } from "../../common/auth-user";
import { Inject } from "@nestjs/common";

const SESSION_TTL_HOURS = 12;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function homePathFor(role: AuthUser["primaryRole"]): "/club" | "/operacion" | "/admin" {
  return role === "admin" ? "/admin" : role === "employee" ? "/operacion" : "/club";
}

@Injectable()
export class AuthService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async login(email: string, password: string): Promise<{ token: string; session: AuthUser & { homePath: string } }> {
    const [credential] = await this.db
      .select({ userId: users.id, email: users.email, displayName: users.displayName, active: users.active, passwordHash: internalCredentials.passwordHash })
      .from(users)
      .innerJoin(internalCredentials, eq(internalCredentials.userId, users.id))
      .where(eq(users.email, email.toLowerCase()));

    if (!credential || !credential.active || !(await argon2.verify(credential.passwordHash, password))) {
      throw new UnauthorizedException("El email o la contraseña no son válidos.");
    }

    const user = await this.getUser(credential.userId);
    if (!user || !user.roles.some((role) => role === "employee" || role === "admin")) {
      throw new UnauthorizedException("Esta cuenta no tiene acceso interno.");
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    await this.db.insert(sessions).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
    return { token, session: { ...user, homePath: homePathFor(user.primaryRole) } };
  }

  async sessionFromToken(token?: string): Promise<AuthUser | undefined> {
    if (!token) return undefined;
    const [session] = await this.db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())));

    return session ? this.getUser(session.userId) : undefined;
  }

  async logout(token?: string): Promise<void> {
    if (!token) return;
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));
  }

  private async getUser(userId: string): Promise<AuthUser | undefined> {
    const roleRows = await this.db
      .select({ name: roles.name, primary: userRoles.primary, id: users.id, displayName: users.displayName, email: users.email, active: users.active })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(users.id, userId));

    const firstRole = roleRows[0];
    if (!firstRole || !firstRole.active) return undefined;
    const primary = roleRows.find((row) => row.primary)?.name ?? firstRole.name;
    const permissionRows = await this.db
      .select({ name: permissions.name })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, userId));

    return {
      id: firstRole.id,
      displayName: firstRole.displayName,
      email: firstRole.email,
      roles: roleRows.map((row) => row.name),
      permissions: [...new Set(permissionRows.map((row) => row.name))],
      primaryRole: primary,
    };
  }
}
