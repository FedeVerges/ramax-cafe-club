import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "sales-visual.spec.ts",
  workers: 1,
  outputDir: "visual-test-results",
  use: {
    baseURL: process.env.RAMAX_BEFORE
      ? "http://127.0.0.1:5174"
      : "http://127.0.0.1:5186",
  },
  ...(process.env.RAMAX_BEFORE
    ? {}
    : {
        webServer: {
          command: "corepack pnpm dev --host 127.0.0.1 --port 5186 --strictPort",
          url: "http://127.0.0.1:5186",
          reuseExistingServer: false,
          timeout: 30000,
        },
      }),
});
