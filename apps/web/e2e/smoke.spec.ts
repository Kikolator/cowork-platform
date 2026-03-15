import { test, expect } from "@playwright/test";

test("dashboard renders for authenticated user", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: /welcome to test space/i }),
  ).toBeVisible();
});

test("admin user sees setup checklist", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("Quick Stats")).toBeVisible();
  await expect(page.getByText("Setup Checklist")).toBeVisible();
});
