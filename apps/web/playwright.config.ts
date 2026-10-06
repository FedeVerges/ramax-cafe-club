import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "sales-visual.spec.ts",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3133",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node ../api/test/start-e2e.cjs",
    url: "http://127.0.0.1:3133/api/v1/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
