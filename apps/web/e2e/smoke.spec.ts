import { test, expect } from "@playwright/test";

test("dashboard renders for authenticated user", async ({ page }) => {
  await page.goto("/dashboard");

  // The heading is a time-of-day greeting (Good morning/afternoon/evening)
  await expect(
    page.getByRole("heading", { name: /good (morning|afternoon|evening)/i }),
  ).toBeVisible();
});

test("admin user sees quick stats", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("Quick Stats")).toBeVisible();
});
