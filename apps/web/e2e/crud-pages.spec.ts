/**
 * E2E — CRUD list pages (Clients, Suppliers, Personnel, Inventory)
 * Smoke tests: page loads, heading visible, not stuck on loading.
 */
import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "./fixtures";

test.use({ storageState: AUTH_FILE });

const PAGES = [
  { path: "/clients",   heading: "Clients" },
  { path: "/suppliers", heading: "Suppliers" },
  { path: "/personnel", heading: "Personnel" },
  { path: "/inventory", heading: "Inventory" },
];

for (const { path, heading } of PAGES) {
  test(`${heading} page loads without errors`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    // Wait for network, then page must not be stuck
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Loading…")).not.toBeVisible({ timeout: 15_000 });
  });
}


test("Suppliers — search input is interactive", async ({ page }) => {
  await page.goto("/suppliers");
  await page.waitForLoadState("networkidle");
  const search = page.getByPlaceholder(/search/i);
  await expect(search).toBeVisible();
  await search.fill("test");
  await expect(search).toHaveValue("test");
});

test("Inventory — category label shown (not raw DB value 'audio_video')", async ({ page }) => {
  await page.goto("/inventory");
  await page.waitForLoadState("networkidle");
  // If any audio_video equipment exists, the label "Audio / Video" should appear,
  // not the raw DB enum value
  const hasAudioVideo = await page.locator("text=audio_video").count();
  expect(hasAudioVideo).toBe(0);
});
