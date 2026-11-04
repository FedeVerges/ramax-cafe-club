import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../../../db/cloud-schema";

export const CLOUD_DATABASE = Symbol("CLOUD_DATABASE");

@Global()
@Module({
  providers: [
    {
      provide: CLOUD_DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pool = new Pool({
          connectionString: config.getOrThrow<string>("CLOUD_DATABASE_URL"),
        });
        pool.on("error", (error) =>
          console.error("Conexión cloud interrumpida", error),
        );
        return drizzle({ client: pool, schema });
      },
    },
  ],
  exports: [CLOUD_DATABASE],
})
export class CloudDatabaseModule {}
