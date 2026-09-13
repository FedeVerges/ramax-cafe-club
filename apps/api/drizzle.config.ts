import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "../../db/schema/*.ts",
  out: "../../db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://ramax:ramax@localhost:5433/ramax",
  },
  strict: true,
});
