import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the production build, not the dev server: the service worker,
 * code splitting and bundle behaviour only exist there, and those are exactly the things unit
 * tests cannot see.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry locally too: under heavy parallel load Chromium can evict an ephemeral test
  // context's storage entirely (every IndexedDB store empty), which reads as data loss but is
  // an artefact of test isolation — see docs/verification/DEFECTS.md V-103. A real regression
  // fails twice and stays red.
  retries: process.env.CI ? 1 : 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Software GL, so the renderer itself can be exercised on a machine with no GPU.
          args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        },
      },
    },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
