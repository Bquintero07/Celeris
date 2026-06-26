/**
 * Auth setup — logs in once, saves the session to a file so all E2E tests
 * can reuse the authenticated state without logging in each time.
 */
import { test as setup, expect } from "@playwright/test";
import { AUTH_FILE } from "./fixtures";

setup("authenticate as admin@agencia-grande.demo", async ({ page }) => {
  await page.goto("/auth");

  // Wait for the login form to appear
  await page.waitForSelector("input[type='email']", { timeout: 10_000 });

  await page.fill("input[type='email']", "admin@agencia-grande.demo");
  await page.fill("input[type='password']", "Demo1234!");
  await page.click("button[type='submit']");

  // After login, we should land on the dashboard or onboarding
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

  // Persist the browser storage (cookies + localStorage) for reuse
  await page.context().storageState({ path: AUTH_FILE });
});
