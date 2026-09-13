import { Injectable } from "@nestjs/common";
import { auditEvents } from "../../../../../db/schema";
import type { Database } from "../../database/database.types";

type AuditWriter = Pick<Database, "insert">;

type AuditEventInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  async record(writer: AuditWriter, event: AuditEventInput): Promise<void> {
    await writer.insert(auditEvents).values({
      actorUserId: event.actorUserId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      reason: event.reason,
      before: event.before,
      after: event.after,
    });
  }
}
