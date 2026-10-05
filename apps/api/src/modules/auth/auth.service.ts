import { inMaintenance } from "../backups/backup-files";
import { STAFF_PERMISSIONS } from "../../../../../packages/contracts/src";
import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { internalCredentials, sessions, users } from "../../../../../db/schema";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import type { AuthUser } from "../../common/auth-user";
import { Inject } from "@nestjs/common";

const SESSION_TTL_HOURS = 12;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function homePathFor(
  role: AuthUser["primaryRole"],
): "/club" | "/operacion" | "/admin" {
  return role === "admin"
    ? "/admin"
    : role === "employee"
      ? "/operacion"
      : "/club";
}

@Injectable()
export class AuthService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async login(
    username: string,
    password: string,
  ): Promise<{ token: string; session: AuthUser & { homePath: string } }> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(714999)`);
      if (inMaintenance())
        throw new ServiceUnavailableException("Restauración en curso.");
      const [credential] = await tx
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          active: users.active,
          role: users.role,
          passwordHash: internalCredentials.passwordHash,
        })
        .from(users)
        .innerJoin(
          internalCredentials,
          eq(internalCredentials.userId, users.id),
        )
        .where(eq(users.username, username.trim().toLowerCase()))
        .for("update", { of: users });

      if (
        !credential ||
        !credential.active ||
        !(await argon2.verify(credential.passwordHash, password))
      ) {
        throw new UnauthorizedException(
          "El usuario o la contraseña no son válidos.",
        );
      }

      const user: AuthUser = {
        id: credential.userId,
        username: credential.username,
        displayName: credential.displayName,
        primaryRole: credential.role,
        roles: [credential.role],
        permissions: [...STAFF_PERMISSIONS[credential.role]],
      };

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(
        Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000,
      );
      await tx
        .insert(sessions)
        .values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
      return {
        token,
        session: { ...user, homePath: homePathFor(user.primaryRole) },
      };
    });
  }

  async sessionFromToken(token?: string): Promise<AuthUser | undefined> {
    if (!token) return undefined;
    const [session] = await this.db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      );

    return session ? this.getUser(session.userId) : undefined;
  }

  async logout(token?: string): Promise<void> {
    if (!token) return;
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(token)));
  }

  private async getUser(userId: string): Promise<AuthUser | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.active) return undefined;
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      primaryRole: user.role,
      roles: [user.role],
      permissions: [...STAFF_PERMISSIONS[user.role]],
    };
  }
}
