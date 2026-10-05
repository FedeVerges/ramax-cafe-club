import * as argon2 from "argon2";
import { inMaintenance } from "../modules/backups/backup-files";
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { idempotencyKeys } from "../../../../db/schema";
import type { Database } from "../database/database.types";
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function requestHash(input: unknown): string {
  return createHash("sha256").update(canonical(input)).digest("hex");
}
export function validateReplay(
  stored: { requestHash: string; expiresAt: Date },
  hash: string,
): void {
  if (stored.expiresAt <= new Date())
    throw new ConflictException({
      code: "IDEMPOTENCY_EXPIRED",
      message: "La clave venció. Consultá el historial antes de continuar.",
    });
  if (stored.requestHash !== hash)
    throw new ConflictException({
      code: "IDEMPOTENCY_CONFLICT",
      message: "La clave ya se usó con otra solicitud.",
    });
}
export async function writeOnce<T>(
  db: Database,
  actor: string,
  scope: string,
  key: string,
  input: unknown,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  if (!key || !key.trim() || key.length > 255)
    throw new BadRequestException("Falta una clave de idempotencia válida.");
  // Password mutations must not leave a fast offline password oracle in the request digest.
  const hash =
    scope === "staff.create" || scope === "staff.password"
      ? requestHash(
          await argon2.hash(canonical(input), {
            type: argon2.argon2id,
            salt: createHash("sha256")
              .update(`${actor}:${scope}:${key}`)
              .digest()
              .subarray(0, 16),
          }),
        )
      : requestHash(input);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock_shared(714999)`);
    if (inMaintenance())
      throw new ServiceUnavailableException(
        "Restauración en curso. Reintentá después.",
      );
    // Serializes identical requests before any side effects, including concurrent retries.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${actor + scope + key}, 0))`,
    );
    const [stored] = await tx
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.actorUserId, actor),
          eq(idempotencyKeys.scope, scope),
          eq(idempotencyKeys.key, key),
        ),
      );
    if (stored) {
      validateReplay(stored, hash);
      return stored.response as T;
    }
    const response = await run(tx);
    await tx.insert(idempotencyKeys).values({
      actorUserId: actor,
      scope,
      key,
      requestHash: hash,
      response,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });
    return response;
  });
}
