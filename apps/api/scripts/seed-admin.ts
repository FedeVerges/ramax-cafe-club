import * as argon2 from "argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { permissions, rolePermissions, roles, userRoles, users, internalCredentials } from "../../../db/schema";

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_NAME ?? "Administrador Ramax";

if (!databaseUrl || !email || !password) {
  throw new Error("Definí DATABASE_URL, ADMIN_EMAIL y ADMIN_PASSWORD antes de ejecutar el seed.");
}

const roleDefinitions = {
  member: { description: "Socio del club", permissions: [] },
  employee: {
    description: "Personal de operación",
    permissions: ["products.read", "inventory.read", "sales.create", "sales.read", "sales.member.attach", "redemptions.validate"],
  },
  admin: {
    description: "Administración del local",
    permissions: [
      "products.read",
      "products.manage",
      "inventory.read",
      "inventory.adjust",
      "sales.create",
      "sales.read",
      "sales.void",
      "sales.member.attach",
      "points.read",
      "points.adjust",
      "rewards.read",
      "rewards.manage",
      "redemptions.validate",
      "redemptions.cancel",
      "campaigns.manage",
      "users.manage",
      "members.anonymize",
      "audit.read",
      "dashboard.read",
    ],
  },
} as const;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle({ client: pool });

  for (const [name, definition] of Object.entries(roleDefinitions)) {
    const [role] = await db
      .insert(roles)
      .values({ name: name as keyof typeof roleDefinitions, description: definition.description })
      .onConflictDoUpdate({ target: roles.name, set: { description: definition.description } })
      .returning();
    if (!role) throw new Error(`No se pudo crear el rol ${name}.`);

    for (const permissionName of definition.permissions) {
      const [permission] = await db
        .insert(permissions)
        .values({ name: permissionName, description: permissionName })
        .onConflictDoNothing()
        .returning();
      const currentPermission = permission ?? (await db.select().from(permissions).where(eq(permissions.name, permissionName)))[0];
      if (!currentPermission) throw new Error(`No se pudo crear el permiso ${permissionName}.`);
      await db.insert(rolePermissions).values({ roleId: role.id, permissionId: currentPermission.id }).onConflictDoNothing();
    }
  }

  const [admin] = await db
    .insert(users)
    .values({ displayName, email })
    .onConflictDoUpdate({ target: users.email, set: { displayName, active: true, updatedAt: new Date() } })
    .returning();
  if (!admin) throw new Error("No se pudo crear el administrador.");
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await db.insert(internalCredentials).values({ userId: admin.id, passwordHash }).onConflictDoUpdate({
    target: internalCredentials.userId,
    set: { passwordHash, updatedAt: new Date() },
  });

  const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin"));
  if (!adminRole) throw new Error("No se encontró el rol admin.");
  await db.delete(userRoles).where(eq(userRoles.userId, admin.id));
  await db.insert(userRoles).values({ userId: admin.id, roleId: adminRole.id, primary: true });

  await pool.end();
  console.log(`Administrador listo: ${email}`);
}

void main();
