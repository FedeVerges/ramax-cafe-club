import { resolve } from "node:path";
import { Pool } from "pg";
import { adaptLegacyLocal } from "../src/database/adapt-legacy-local";

async function main() {
  if (process.argv[2] !== "--confirm" || !process.env.DATABASE_URL) {
    throw new Error("Definí DATABASE_URL y usá --confirm después de guardar y verificar una copia.");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await adaptLegacyLocal(pool, resolve(process.env.MIGRATIONS_DIR ?? "./db/migrations"));
    console.log("Base local adaptada. Historial y tablas anteriores conservados.");
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error("La adaptación falló y se revirtió. Revisá el historial y la compatibilidad de los datos.");
  process.exitCode = 1;
});
