import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../../db/schema";

export type Database = NodePgDatabase<typeof schema>;
