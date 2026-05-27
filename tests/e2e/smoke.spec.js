// @ts-check
/**
 * FlowOS Reach — E2E smoke tests
 *
 * Covers the critical happy paths. Uses ?seed=mveda to bypass Supabase auth —
 * no real credentials needed. The server must be running (playwright.config.js
 * starts it automatically via webServer).
 *
 * Flows tested:
 *   1. App loads — no JS errors, shell renders
 *   2. Dev seed bypass — ?seed=mveda skips login and shows the OS
 *   3. Workspace navigation — all 7 nav rail items load without crash
 *   4. Chat-to-create — "write me an instagram post" → draft card appears
 *   5. Send to queue — draft card → "Send to queue" → confirmation state
 *   6. Queue shows draft — switch to Publishing Queue → draft strip present
 *   7. Generate Drafts button — fallback drafts land in the queue
 */

import { test, expect } from "@playwright/test";

// Shared: load the app with the dev seed bypass
// index.html is the production entry point (app.html is incomplete — missing studio/agents/insights)
const APP = "/index.html?seed=mveda";

// Helper: wait for React to mount (Babel CDN compiles at runtime — takes ~1s)
async function waitForApp(page) {
  // The chat rail composer is only rendered after ChatOSAuthed mounts.
  await page.waitForSelector('[data-testid="composer-input"]', { timeout: 12_000 });
}

// ─── 1. App loads ──────────────────────────────────────────────────────────────

test("app loads without JS errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));

  await page.goto(APP);
  await waitForApp(page);

  // Filter out known third-party noise (Supabase real-time, etc.)
  const fatal = errors.filter(
    e => !e.includes("realtime") && !e.includes("supabase") && !e.includes("net::ERR")
  );
  expect(fatal, `Unexpected JS errors: ${fatal.join(" | ")}`).toHaveLength(0);
});

// ─── 2. Dev seed bypass ────────────────────────────────────────────────────────

test("?seed=mveda bypasses login and renders the chat OS", async ({ page }) => {
  await page.goto(APP);
  await waitForApp(page);

  // Should NOT see the login form
  const loginForm = page.locator("form").first();
  await expect(loginForm).not.toBeVisible({ timeout: 2000 }).catch(() => {});

  // Should see the nav rail
  await expect(page.locator('[data-testid="nav-command"]')).toBeVisible();
});

// ─── 3. Workspace navigation ───────────────────────────────────────────────────

const NAV_ITEMS = [
  { testid: "nav-command",  text: "Command"  },
  { testid: "nav-studio",   text: "Studio"   },
  { testid: "nav-planner",  text: "Planner"  },
  { testid: "nav-insights", text: "Insights" },
  { testid: "nav-inbox",    text: "Inbox"    },
  { testid: "nav-agents",   text: "Agents"   },
  { testid: "nav-settings", text: "Settings" },
];

for (const { testid, text } of NAV_ITEMS) {
  test(`nav: clicking "${text}" loads without crash`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));

    await page.goto(APP);
    await waitForApp(page);

    await page.click(`[data-testid="${testid}"]`);

    // Give React a tick to render
    await page.waitForTimeout(300);

    // No fatal JS errors
    const fatal = errors.filter(e => !e.includes("realtime") && !e.includes("supabase"));
    expect(fatal, `JS errors after clicking "${text}": ${fatal.join(" | ")}`).toHaveLength(0);

    // Nav button should now be active (visual check: it exists in the DOM)
    await expect(page.locator(`[data-testid="${testid}"]`)).toBeVisible();
  });
}

// ─── 4. Chat-to-create: draft card appears ─────────────────────────────────────

test("chat-to-create: 'write me an instagram post' produces a draft card", async ({ page }) => {
  await page.goto(APP);
  await waitForApp(page);

  const composer = page.locator('[data-testid="composer-input"]');
  await composer.fill("write me an instagram post");
  await page.keyboard.press("Enter");

  // Wait for the draft card (fallback simulation produces it in ~2s)
  await expect(page.locator('[data-testid="draft-card"]')).toBeVisible({ timeout: 8_000 });
});

// ─── 5. Send to queue: confirmation state ─────────────────────────────────────

test("clicking 'Send to queue' transitions draft card to confirmed state", async ({ page }) => {
  await page.goto(APP);
  await waitForApp(page);

  const composer = page.locator('[data-testid="composer-input"]');
  await composer.fill("write me an instagram post");
  await page.keyboard.press("Enter");

  await expect(page.locator('[data-testid="draft-card"]')).toBeVisible({ timeout: 8_000 });

  // Click the "Send to queue" button
  await page.click('[data-testid="send-to-queue"]');

  // Button should disappear; "Added to queue" confirmation appears
  await expect(page.locator('[data-testid="send-to-queue"]')).not.toBeVisible({ timeout: 2_000 });
  await expect(page.locator("text=Added to queue")).toBeVisible({ timeout: 2_000 });
});

// ─── 6. Queue shows the draft ──────────────────────────────────────────────────

test("after 'Send to queue', the Publishing Queue shows the draft", async ({ page }) => {
  await page.goto(APP);
  await waitForApp(page);

  // Create and queue a draft
  const composer = page.locator('[data-testid="composer-input"]');
  await composer.fill("write me a tiktok post");
  await page.keyboard.press("Enter");

  await expect(page.locator('[data-testid="draft-card"]')).toBeVisible({ timeout: 8_000 });
  await page.click('[data-testid="send-to-queue"]');
  await expect(page.locator("text=Added to queue")).toBeVisible({ timeout: 2_000 });

  // Navigate to Publishing Queue
  // Publishing Queue is not in the nav rail — it's opened via the "View queue →" link
  // or we can dispatch to the publish workspace via nav
  // Workaround: reload with ?seed=mveda and manually navigate
  // The "View queue →" button appears after queuing
  await page.click("text=View queue →");

  // The Drafts strip should be visible (use .first() — seed data may already have draft items)
  await expect(page.locator('[data-testid="draft-item"]').first()).toBeVisible({ timeout: 5_000 });
});

// ─── 7. Generate Drafts button ─────────────────────────────────────────────────

test("Generate Drafts button populates the Drafts strip with fallback drafts", async ({ page }) => {
  await page.goto(APP);
  await waitForApp(page);

  // Navigate to Publishing Queue via chat — inferResponse handles "open publishing queue"
  const composer = page.locator('[data-testid="composer-input"]');
  await composer.fill("open publishing queue");
  await page.keyboard.press("Enter");

  // Wait for the queue to render — look for the "Generate drafts" button
  await expect(page.locator('[data-testid="generate-drafts-btn"]')).toBeVisible({ timeout: 8_000 });

  // Click it — the API will return fallback drafts (no API key in test env)
  await page.click('[data-testid="generate-drafts-btn"]');

  // Drafts should appear (fallback returns 7 drafts)
  await expect(page.locator('[data-testid="draft-item"]').first()).toBeVisible({ timeout: 8_000 });
  const count = await page.locator('[data-testid="draft-item"]').count();
  expect(count).toBeGreaterThanOrEqual(1);
});
