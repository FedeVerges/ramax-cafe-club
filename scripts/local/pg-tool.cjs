const { spawnSync } = require("node:child_process");
const { openSync, closeSync } = require("node:fs");

// Usa las herramientas del PostgreSQL local sin montar secretos ni copias en Docker.
const [tool, ...args] = process.argv.slice(2);
if (!["pg_dump", "pg_restore"].includes(tool)) process.exit(2);
const dockerArgs = ["exec", "-i", "-e", "PGUSER", "-e", "PGPASSWORD", "-e", "PGDATABASE", "-e", "PGHOST=127.0.0.1", "-e", "PGPORT=5432", process.env.LOCAL_PG_CONTAINER ?? "ramax-cafe-club-postgres-1", tool];
let file;
let descriptor;
try {
  if (tool === "pg_dump") {
    const index = args.indexOf("--file");
    if (index < 0 || !args[index + 1]) throw new Error("Falta el archivo de copia.");
    file = args.splice(index, 2)[1];
    descriptor = openSync(file, "w", 0o600);
  } else {
    file = args.pop();
    if (!file || file.startsWith("-")) throw new Error("Falta el archivo de restauración.");
    descriptor = openSync(file, "r");
  }
  const result = spawnSync("docker", [...dockerArgs, ...args], {
    env: process.env,
    stdio: tool === "pg_dump" ? ["ignore", descriptor, "inherit"] : [descriptor, "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch {
  console.error("No se pudo ejecutar la herramienta PostgreSQL local.");
  process.exitCode = 1;
} finally {
  if (descriptor !== undefined) closeSync(descriptor);
}
