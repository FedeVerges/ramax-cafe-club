import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { CLOUD_DATABASE } from "./cloud-database/cloud-database.module";
import type { CloudDatabase } from "./cloud-database/cloud-database.types";

@Controller("health")
export class CloudHealthController {
  constructor(@Inject(CLOUD_DATABASE) private readonly db: CloudDatabase) {}

  @Get()
  async health() {
    try {
      await this.db.execute(sql`select 1 from members limit 1`);
    } catch {
      throw new ServiceUnavailableException("La base cloud no está disponible.");
    }
    return { cloud: true };
  }
}
