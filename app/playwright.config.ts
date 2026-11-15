import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the production build, not the dev server: the service worker,
 * code splitting and bundle behaviour only exist there, and those are exactly the things unit
 * tests cannot see.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // One worker everywhere: two pages rendering the eye in software GL at once starve each other
  // and time out (V-107), on a laptop and on a CI runner alike. This does not classify failures
  // as harmless.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // A CI runner has no GPU, so every page that shows the eye compiles its shaders in software
  // GL, which there takes tens of seconds and holds up the browser for whatever comes next —
  // even opening the next test's context (V-107). These tests check behaviour, not speed, so CI
  // gets a budget that fits that machine. Locally the defaults stay, so slowness on a real
  // machine still fails. Retries stay at zero: a pass on retry would not explain the failure.
  timeout: process.env.CI ? 120_000 : 30_000,
  expect: { timeout: process.env.CI ? 20_000 : 5_000 },
  // CI prints each test as it runs and keeps a report with traces for any failure.
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
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
