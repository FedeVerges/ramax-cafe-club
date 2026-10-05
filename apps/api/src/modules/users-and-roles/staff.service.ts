import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import * as argon2 from "argon2";
import { internalCredentials, sessions, users } from "../../../../../db/schema";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import { writeOnce } from "../../common/idempotency";
import { AuditService } from "../audit/audit.service";
import type { CreateStaffDto } from "./dto/staff.dto";

@Injectable()
export class StaffService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}
  list() {
    return this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        active: users.active,
      })
      .from(users)
      .orderBy(users.displayName);
  }
  create(actor: string, key: string, input: CreateStaffDto) {
    return writeOnce(this.db, actor, "staff.create", key, input, async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          username: input.username,
          displayName: input.displayName,
          role: input.role,
        })
        .onConflictDoNothing()
        .returning();
      if (!user) throw new ConflictException("El usuario ya existe.");
      await tx
        .insert(internalCredentials)
        .values({
          userId: user.id,
          passwordHash: await argon2.hash(input.password, {
            type: argon2.argon2id,
          }),
        });
      await this.audit.record(tx, {
        actorUserId: actor,
        action: "staff.created",
        entityType: "staff",
        entityId: user.id,
        after: { username: user.username, role: user.role },
      });
      return user;
    });
  }
  change(actor: string, key: string, id: string, password?: string) {
    return writeOnce(
      this.db,
      actor,
      password === undefined ? "staff.deactivate" : "staff.password",
      key,
      { id, password },
      async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(714001)`);
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, id))
          .for("update");
        if (!user) throw new NotFoundException("No encontramos esa cuenta.");
        if (password === undefined) {
          const admins = await tx
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.role, "admin"), eq(users.active, true)));
          if (user.active && user.role === "admin" && admins.length === 1)
            throw new ConflictException(
              "No podés desactivar al último administrador activo.",
            );
          await tx
            .update(users)
            .set({ active: false, updatedAt: new Date() })
            .where(eq(users.id, id));
        } else {
          await tx
            .update(internalCredentials)
            .set({
              passwordHash: await argon2.hash(password, {
                type: argon2.argon2id,
              }),
              updatedAt: new Date(),
            })
            .where(eq(internalCredentials.userId, id));
        }
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.userId, id));
        await this.audit.record(tx, {
          actorUserId: actor,
          action:
            password === undefined
              ? "staff.deactivated"
              : "staff.password_reset",
          entityType: "staff",
          entityId: id,
        });
        return { id, success: true };
      },
    );
  }
}
