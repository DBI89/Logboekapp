import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const chromium = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3200",
    viewport: { width: 1280, height: 900 },
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  webServer: {
    command: "npm run seed && npx next build && npx next start -p 3200",
    url: "http://localhost:3200",
    timeout: 300_000,
    reuseExistingServer: false,
  },
});
