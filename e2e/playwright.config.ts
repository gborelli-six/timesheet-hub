import { defineConfig, devices } from "@playwright/test";
import path from "path";

// ADR-003-A: baseURL verso nginx (porta 80) che fa proxy a backend e frontend.
// Variabili d'ambiente per sovrascrivere in CI o in scenari senza proxy.
const BASE_URL = process.env.BASE_URL ?? "http://localhost";

export const authDir = path.join(__dirname, ".auth");

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",

  timeout: 30_000,
  expect: { timeout: 10_000 },

  // Retry solo in CI — ADR-003-F
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  // Artefatti su failure — ADR-003-F
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ...(process.env.CI ? [["github"] as ["github"]] : []),
  ],

  outputDir: "test-results",

  use: {
    baseURL: BASE_URL,
    trace: process.env.CI ? "on-first-retry" : "off",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    // Setup unico per tutti e 3 i ruoli (STORY-020).
    // Esegue auth.setup.ts prima dei test principali.
    {
      name: "setup:auth",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // Progetto principale: dipende da setup:auth (ADR-003-B).
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup:auth"],
    },
  ],
});
