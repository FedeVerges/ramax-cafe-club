import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../../db/cloud-schema";

export type CloudDatabase = NodePgDatabase<typeof schema>;
