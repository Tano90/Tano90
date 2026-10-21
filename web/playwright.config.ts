// End-to-end tests against a production build on Postgres with the demo seed.
//   E2E_DATABASE_URL=postgres://... npm run e2e
// The database must be migrated (npm run db:migrate); every spec file reseeds it.
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3200);
if (!process.env.E2E_DATABASE_URL) throw new Error("E2E_DATABASE_URL is required (a migrated Postgres the tests may reset).");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // specs share one database and reseed it
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-proxy-server"] },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx next start -p ${port}`,
    port,
    reuseExistingServer: false,
    env: { DATABASE_URL: process.env.E2E_DATABASE_URL, ALLOW_DEMO: "1", LEGACY_APP: "1", APP_URL: `http://localhost:${port}`, OPERATOR_EMAILS: "inhaber@example.com", LEADS_NOTIFY_EMAIL: "vertrieb@example.com" },
  },
});
