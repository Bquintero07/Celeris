import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  workers: 1, // pgbouncer connection_limit=1 — sequential only
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    // 1. Run auth setup first to persist session
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },
    // 2. Run all spec files using the saved auth state
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  // Start the dev server automatically before running e2e tests
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
