import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "../../db/cloud-schema/*.ts",
  out: "../../db/cloud-migrations",
  dbCredentials: {
    url: process.env.CLOUD_DATABASE_URL ?? "postgresql://ramax:ramax@localhost:5433/ramax_cloud",
  },
  strict: true,
});
