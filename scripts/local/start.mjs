import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const load = (name) => existsSync(resolve(root, name)) ? parseEnv(readFileSync(resolve(root, name), "utf8")) : {};
const env = { ...load(".env"), ...load(".env.local"), ...process.env };
if (!env.DATABASE_URL || !env.WEB_DIST_DIR || !env.PG_BIN_DIR) {
  throw new Error("Configurá DATABASE_URL en .env y WEB_DIST_DIR y PG_BIN_DIR en .env.local.");
}
const docker = spawnSync("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "60", "postgres"], { cwd: root, env, stdio: "inherit" });
if (docker.status !== 0) throw new Error("Docker Desktop debe estar iniciado.");
if (!env.LOCAL_PG_CONTAINER) {
  const container = spawnSync("docker", ["compose", "ps", "-q", "postgres"], { cwd: root, env, encoding: "utf8" });
  if (container.status !== 0 || !container.stdout.trim()) throw new Error("No se encontró el contenedor PostgreSQL local.");
  env.LOCAL_PG_CONTAINER = container.stdout.trim();
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  const timeout = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 5000);
  timeout.unref();
}
for (const entry of ["main", "recovery-worker"]) {
  const child = spawn(process.execPath, [resolve(root, `apps/api/dist/apps/api/src/${entry}.js`)], { cwd: root, env, stdio: "inherit" });
  children.push(child);
  child.on("error", () => stop(1));
  child.on("exit", (code) => { if (!stopping) stop(code || 1); });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
console.log(`Ramax local: ${env.WEB_ORIGIN}. Ctrl+C detiene API y copias.`);
