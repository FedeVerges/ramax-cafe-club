import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DATABASE } from "./database/database.module";
import type { Database } from "./database/database.types";
import { inMaintenance } from "./modules/backups/backup-files";
@Controller("health")
export class HealthController {
  private internet: boolean | null = null;
  private checkedAt = 0;
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  @Get() async health() {
    try {
      await this.db.execute(sql`select 1 from users limit 1`);
    } catch {
      throw new ServiceUnavailableException(
        "La base local no está disponible.",
      );
    }
    if (Date.now() - this.checkedAt > 30000) {
      this.checkedAt = Date.now();
      void fetch(process.env.INTERNET_PROBE_URL?.trim() || "https://www.google.com/generate_204", {
        method: "HEAD",
        signal: AbortSignal.timeout(2000),
      })
        .then((r) => {
          this.internet = r.ok;
        })
        .catch(() => {
          this.internet = false;
        });
    }
    return {
      local: true,
      internet: this.internet,
      maintenance: inMaintenance(),
    };
  }
}
