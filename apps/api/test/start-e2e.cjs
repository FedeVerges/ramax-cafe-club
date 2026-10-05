const { Pool } = require("pg");
const argon2 = require("argon2");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");
async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error(
      "Definí TEST_DATABASE_URL con una base de prueba terminada en _test.",
    );
  const pool = new Pool({ connectionString: url });
  try {
    const hash = await argon2.hash("PruebaRamax123");
    for (const [username, role] of [
      ["e2e_admin", "admin"],
      ["e2e_employee", "employee"],
    ]) {
      const { rows } = await pool.query(
        "INSERT INTO users(username,display_name,staff_role) VALUES($1,$1,$2) ON CONFLICT(username) DO UPDATE SET active=true RETURNING id",
        [username, role],
      );
      await pool.query(
        "INSERT INTO internal_credentials(user_id,password_hash) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET password_hash=$2",
        [rows[0].id, hash],
      );
    }
  } finally {
    await pool.end();
  }
  const child = spawn(
    process.execPath,
    [resolve("../api/dist/apps/api/src/main.js")],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: url,
        NODE_ENV: "test",
        PORT: "3133",
        WEB_DIST_DIR: resolve("dist"),
        BACKUP_DIR: resolve("../../var/e2e-backups"),
        WEB_ORIGIN: "http://127.0.0.1:3133",
        INTERNET_PROBE_URL: "http://127.0.0.1:1",
      },
    },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => process.exit(code ?? 0));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
