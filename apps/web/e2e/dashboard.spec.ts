/**
 * E2E — Dashboard
 * Requires: dev server (pnpm dev) + Docker (API + agent) running.
 * Logged in as admin@agencia-grande.demo via stored auth state.
 */
import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "./fixtures";

test.use({ storageState: AUTH_FILE });

test("Dashboard loads and shows KPI cards", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // KPI cards — look for the uppercase tracking-wide label spans
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".tracking-wide", { hasText: "Events" }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".tracking-wide", { hasText: "Personnel" }).first()).toBeVisible();
  await expect(page.locator(".tracking-wide", { hasText: "Suppliers" }).first()).toBeVisible();
  await expect(page.locator(".tracking-wide", { hasText: "Equipment" }).first()).toBeVisible();
});

test("Dashboard shows financial section", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Total Budget")).toBeVisible();
  await expect(page.getByText("Projected Revenue")).toBeVisible();
});

test("New AI Event button navigates to /events/new", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /new ai event/i }).click();
  await expect(page).toHaveURL(/\/events\/new/);
});
