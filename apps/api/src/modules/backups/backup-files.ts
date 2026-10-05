import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  BackupInfo,
  RecoveryJob,
} from "../../../../../packages/contracts/src";
export function projectRoot() {
  let directory = process.cwd();
  while (!existsSync(join(directory, "pnpm-workspace.yaml"))) {
    const parent = dirname(directory);
    if (parent === directory)
      throw new Error("No se encontró la raíz de Ramax.");
    directory = parent;
  }
  return directory;
}
export const backupDir = () =>
  resolve(projectRoot(), process.env.BACKUP_DIR ?? "./var/backups");
export const maintenancePath = () => join(backupDir(), "maintenance.json");
export const inMaintenance = () => existsSync(maintenancePath());
export async function writeJson(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, path);
}
export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}
export async function prepareBackupDir() {
  await mkdir(backupDir(), { recursive: true });
}
export async function listBackups(): Promise<BackupInfo[]> {
  await prepareBackupDir();
  const names = await readdir(backupDir());
  const entries = await Promise.all(
    names
      .filter((n) => n.endsWith(".backup.json"))
      .map((n) => readJson<BackupInfo>(join(backupDir(), n))),
  );
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function listJobs(): Promise<RecoveryJob[]> {
  await prepareBackupDir();
  const names = await readdir(backupDir());
  return Promise.all(
    names
      .filter((n) => n.endsWith(".job.json"))
      .map((n) => readJson<RecoveryJob>(join(backupDir(), n))),
  );
}
export async function schemaVersion(): Promise<string> {
  const dir = resolve(
    projectRoot(),
    process.env.MIGRATIONS_DIR ?? "./db/migrations",
  );
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  const hash = createHash("sha256");
  for (const name of names) hash.update(await readFile(join(dir, name)));
  return hash.digest("hex");
}
export function businessDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/San_Luis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export async function clearMaintenance() {
  await unlink(maintenancePath());
}
