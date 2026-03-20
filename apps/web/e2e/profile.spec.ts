import { test, expect } from "@playwright/test";

test.describe("Profile page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL("**/profile");
  });

  test("renders heading and description", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Profile" }),
    ).toBeVisible();
    await expect(
      page.getByText("Manage your personal information and preferences."),
    ).toBeVisible();
  });

  test("shows three tabs", async ({ page }) => {
    const tabList = page.getByRole("tablist");
    await expect(tabList).toBeVisible();

    await expect(
      tabList.getByRole("tab", { name: "Personal" }),
    ).toBeVisible();
    await expect(
      tabList.getByRole("tab", { name: "Professional & Billing" }),
    ).toBeVisible();
    await expect(
      tabList.getByRole("tab", { name: "Notifications" }),
    ).toBeVisible();
  });

  test("Personal tab is selected by default", async ({ page }) => {
    const personalTab = page.getByRole("tab", { name: "Personal" });
    await expect(personalTab).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Profile page - Personal tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL("**/profile");
  });

  test("shows the personal form fields", async ({ page }) => {
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeDisabled();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Phone")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Profile" }),
    ).toBeVisible();
  });

  test("email field is read-only with helper text", async ({ page }) => {
    await expect(
      page.getByText("Email cannot be changed."),
    ).toBeVisible();
  });
});

test.describe("Profile page - Professional & Billing tab", () => {
  test("navigating via tab click shows professional content", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.waitForURL("**/profile");

    const profTab = page.getByRole("tab", {
      name: "Professional & Billing",
    });
    await profTab.click();
    await expect(profTab).toHaveAttribute("aria-selected", "true");

    // The tab panel should be visible with either the form or the no-membership message
    const panel = page.getByRole("tabpanel");
    await expect(panel).toBeVisible();
  });

  test("navigating via URL param selects Professional tab", async ({
    page,
  }) => {
    await page.goto("/profile?tab=professional");
    await page.waitForURL("**/profile?tab=professional");

    const profTab = page.getByRole("tab", {
      name: "Professional & Billing",
    });
    await expect(profTab).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Profile page - Notifications tab", () => {
  test("navigating via tab click shows notification preferences", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.waitForURL("**/profile");

    const notifTab = page.getByRole("tab", { name: "Notifications" });
    await notifTab.click();
    await expect(notifTab).toHaveAttribute("aria-selected", "true");

    // Verify notification toggle labels are visible
    await expect(page.getByText("Booking reminders")).toBeVisible();
    await expect(page.getByText("Credit warnings")).toBeVisible();
    await expect(page.getByText("Marketing")).toBeVisible();
    await expect(page.getByText("Weekly summary")).toBeVisible();
    await expect(page.getByText("Preferred channel")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Preferences" }),
    ).toBeVisible();
  });

  test("navigating via URL param selects Notifications tab", async ({
    page,
  }) => {
    await page.goto("/profile?tab=notifications");
    await page.waitForURL("**/profile?tab=notifications");

    const notifTab = page.getByRole("tab", { name: "Notifications" });
    await expect(notifTab).toHaveAttribute("aria-selected", "true");

    await expect(page.getByText("Booking reminders")).toBeVisible();
  });

  test("notification toggles are interactive", async ({ page }) => {
    await page.goto("/profile?tab=notifications");
    await page.waitForURL("**/profile?tab=notifications");

    // The switches should be present and clickable
    const bookingSwitch = page.locator("#notif-booking");
    await expect(bookingSwitch).toBeVisible();

    const marketingSwitch = page.locator("#notif-marketing");
    await expect(marketingSwitch).toBeVisible();
  });
});
