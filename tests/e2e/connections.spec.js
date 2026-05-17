// @ts-check
/**
 * Connectors redesign — manual verification harness.
 * Loads the OS with the dev seed bypass, navigates into Connections,
 * and screenshots key states.
 */

import { test, expect } from "@playwright/test";

const MVEDA    = "/index.html?seed=mveda";
const ERICKSON = "/index.html?seed=erickson";

async function waitForApp(page) {
  await page.waitForSelector('[data-testid="composer-input"]', { timeout: 12_000 });
}

async function openConnections(page) {
  // Click Settings in the nav rail → "Open Connections →" button in Settings Hub.
  await page.getByRole("button", { name: /^Settings$/i }).first().click();
  await page.getByRole("button", { name: /Open Connections/i }).first().click();
  await page.getByRole("heading", { name: /^Integrations$/ }).waitFor({ timeout: 8_000 });
}

test("connections grid renders + Connect modal opens for OAuth tile", async ({ page }) => {
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));

  await page.goto(MVEDA);
  await waitForApp(page);
  await openConnections(page);

  // Wait for favicons to load before the first screenshot.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  // 1. Grid screenshot
  await page.screenshot({ path: "test-results/connections-mveda-grid.png", fullPage: true });

  // 2. Open Connect modal for an unconnected OAuth tile (Pinterest is unconnected for MVEDA).
  // Tile button has accessible name "Pinterest Pinterest" (img alt + visible label).
  await page.getByRole("button", { name: "Pinterest Pinterest" }).click();
  await page.getByText("Connect Pinterest").first().waitFor({ timeout: 4_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/connections-connect-modal.png", fullPage: true });

  // 3. Close modal
  await page.getByRole("button", { name: /Cancel/i }).first().click();

  // 4. Open Manage modal for a connected tile (Klaviyo is connected for MVEDA)
  await page.getByRole("button", { name: "Klaviyo Klaviyo Connected" }).click();
  await page.getByText("Manage Klaviyo").first().waitFor({ timeout: 4_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/connections-manage-modal.png", fullPage: true });

  // Filter out third-party noise
  const fatal = errors.filter(e => !e.includes("realtime") && !e.includes("supabase") && !e.includes("net::ERR"));
  expect(fatal, `JS errors: ${fatal.join(" | ")}`).toHaveLength(0);
});

test("connections grid renders for Erickson tenant + filter pills work", async ({ page }) => {
  await page.goto(MVEDA);
  await waitForApp(page);

  // Switch to Erickson via the account switcher in the nav rail.
  await page.getByRole("button", { name: /MVEDA/i }).first().click();
  await page.getByRole("button", { name: /Erickson/i }).first().click();
  await page.waitForTimeout(300);

  await openConnections(page);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  await page.screenshot({ path: "test-results/connections-erickson-grid.png", fullPage: true });

  // Click the "Ads" pill, take screenshot to confirm filtering works.
  await page.getByRole("button", { name: /^Ads$/ }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/connections-erickson-ads-filter.png", fullPage: true });
});
