import * as argon2 from "argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users, internalCredentials, auditEvents } from "../../../db/schema";
const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (
  !process.env.DATABASE_URL ||
  !username ||
  !/^[a-z0-9._@-]+$/.test(username) ||
  !password ||
  password.length < 8
) {
  throw new Error(
    "Definí DATABASE_URL, ADMIN_USERNAME y ADMIN_PASSWORD de al menos 8 caracteres.",
  );
}
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const db = drizzle(pool);
    await db.transaction(async (tx) => {
      const [admin] = await tx
        .insert(users)
        .values({
          username: username!,
          displayName: process.env.ADMIN_NAME ?? "Administrador Ramax",
          role: "admin",
        })
        .onConflictDoNothing()
        .returning();
      if (!admin)
        throw new Error(
          "La cuenta ya existe. Usá el restablecimiento administrativo.",
        );
      await tx
        .insert(internalCredentials)
        .values({
          userId: admin.id,
          passwordHash: await argon2.hash(password!, { type: argon2.argon2id }),
        });
      await tx
        .insert(auditEvents)
        .values({
          actorUserId: admin.id,
          action: "staff.bootstrap",
          entityType: "staff",
          entityId: admin.id,
          after: { username, role: "admin" },
        });
    });
    console.log("Administrador creado.");
  } finally {
    await pool.end();
  }
}
void main();
