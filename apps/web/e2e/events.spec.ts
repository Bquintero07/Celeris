/**
 * E2E — Events list and detail
 */
import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "./fixtures";

test.use({ storageState: AUTH_FILE });

test("Events list page loads and data resolves", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=Loading…")).not.toBeVisible({ timeout: 15_000 });
});


test("Clicking an event card navigates to detail page", async ({ page }) => {
  await page.goto("/events");
  await page.waitForLoadState("networkidle");

  const cards = page.locator(".grid a[href^='/events/']");
  const count = await cards.count();
  if (count === 0) {
    test.skip(); // No events seeded
    return;
  }
  await cards.first().click();
  await expect(page).toHaveURL(/\/events\/[a-f0-9-]{36}/);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=Loading…")).not.toBeVisible({ timeout: 12_000 });
});
