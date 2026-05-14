// @ts-check
import { defineConfig } from "@playwright/test";

/**
 * FlowOS — Playwright E2E configuration
 *
 * The tests use the Python dev server (server.py, port 8765).
 * Start it before running: python3 server.py  (or let `webServer` below do it).
 *
 * Run all E2E:    npx playwright test
 * Run with UI:   npx playwright test --ui
 * Run headed:    npx playwright test --headed
 */

export default defineConfig({
  testDir:   "./tests/e2e",
  timeout:   20_000,
  retries:   1,

  use: {
    baseURL:           "http://127.0.0.1:8765",
    headless:          true,
    viewport:          { width: 1440, height: 900 },
    // Seed bypass — no Supabase needed in tests
    // Individual tests append ?seed=mveda to the URL.
    // Use index.html (production entry point) not app.html (missing studio/agents/insights)
    ignoreHTTPSErrors: true,
    video:             "retain-on-failure",
    screenshot:        "only-on-failure",
  },

  // Automatically start the dev server when running E2E tests.
  // If it's already running on 8765 this is skipped.
  webServer: {
    command:           "python3 server.py",
    url:               "http://127.0.0.1:8765/index.html",
    reuseExistingServer: true,
    timeout:           10_000,
    stdout:            "pipe",
    stderr:            "pipe",
  },

  projects: [
    {
      name: "chromium",
      use:  { browserName: "chromium" },
    },
  ],
});
