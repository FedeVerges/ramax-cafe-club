import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import type { RecoveryJob } from "../../../../../packages/contracts/src";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/database.types";
import type { AuthUser } from "../../common/auth-user";
import {
  backupDir,
  listBackups,
  listJobs,
  prepareBackupDir,
  readJson,
  inMaintenance,
} from "./backup-files";
import type { RestoreDto } from "./restore.dto";
@Injectable()
export class BackupsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async list() {
    return {
      backups: await listBackups(),
      jobs: await listJobs(),
      maintenance: inMaintenance(),
    };
  }
  async restore(actor: AuthUser, key: string, body: RestoreDto) {
    if (!key?.trim() || key.length > 255)
      throw new BadRequestException("Falta la clave de idempotencia.");
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(714997)`);
      await prepareBackupDir();
      const id = createHash("sha256")
        .update(`${actor.id}:${key}`)
        .digest("hex");
      const path = join(backupDir(), `${id}.job.json`);
      const existing = await readJson<RecoveryJob>(path).catch(() => undefined);
      if (existing) {
        if (Date.now() - Date.parse(existing.createdAt) >= 30 * 86400000) {
          throw new ConflictException({
            code: "IDEMPOTENCY_EXPIRED",
            message:
              "La clave venció. Consultá el historial de restauraciones.",
          });
        }
        if (existing.backupId !== body.backupId)
          throw new ConflictException("La clave ya se usó con otra copia.");
        return existing;
      }
      const backup = (await listBackups()).find(
        (b) => b.id === body.backupId && b.status === "valid",
      );
      if (!backup)
        throw new BadRequestException("La copia no está disponible.");
      if (
        inMaintenance() ||
        (await listJobs()).some((j) =>
          ["pending", "running"].includes(j.status),
        )
      )
        throw new ConflictException("Ya hay una restauración en curso.");
      const job: RecoveryJob = {
        id,
        backupId: body.backupId,
        actorId: actor.id,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      try {
        await writeFile(path, JSON.stringify(job), { flag: "wx", mode: 0o600 });
      } catch {
        throw new ConflictException(
          "La solicitud ya fue registrada. Consultá su estado.",
        );
      }
      return job;
    });
  }
}
