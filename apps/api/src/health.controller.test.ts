import { afterEach, expect, it, vi } from "vitest";
import { HealthController } from "./health.controller";
import type { Database } from "./database/database.types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const controller = () => new HealthController({ execute: vi.fn().mockResolvedValue([]) } as unknown as Database);

it("detecta internet aunque example.com no resuelva en la red local", async () => {
  vi.stubEnv("INTERNET_PROBE_URL", undefined);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "https://www.google.com/generate_204") return new Response(null, { status: 204 });
    throw new TypeError("ENOTFOUND");
  }));
  const health = controller();
  await health.health();
  await vi.waitFor(async () => expect((await health.health()).internet).toBe(true));
});

it("respeta el destino configurado y mantiene disponible la operación local si falla", async () => {
  vi.stubEnv("INTERNET_PROBE_URL", "http://127.0.0.1:1");
  const fetch = vi.fn().mockRejectedValue(new TypeError("Connection refused"));
  vi.stubGlobal("fetch", fetch);
  const health = controller();
  await health.health();
  await vi.waitFor(async () => expect(await health.health()).toMatchObject({ local: true, internet: false }));
  expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:1", expect.objectContaining({ method: "HEAD" }));
});
