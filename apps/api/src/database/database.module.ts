import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../../../db/schema";

export const DATABASE = Symbol("DATABASE");

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pool = new Pool({ connectionString: config.getOrThrow<string>("DATABASE_URL") });
        return drizzle({ client: pool, schema });
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
