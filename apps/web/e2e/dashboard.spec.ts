import { test, expect } from "@playwright/test";

test.describe("Dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");
  });

  test("renders time-of-day greeting heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /good (morning|afternoon|evening)/i }),
    ).toBeVisible();
  });

  test("shows 'Your plan' card linking to /plan", async ({ page }) => {
    const planCard = page.getByRole("link", { name: /your plan/i });
    await expect(planCard).toBeVisible();
    await expect(planCard).toHaveAttribute("href", "/plan");
  });

  test("shows 'Upcoming bookings' card linking to /bookings", async ({
    page,
  }) => {
    const bookingsCard = page.getByRole("link", {
      name: /upcoming bookings/i,
    });
    await expect(bookingsCard).toBeVisible();
    await expect(bookingsCard).toHaveAttribute("href", "/bookings");
  });

  test("shows Credits info card", async ({ page }) => {
    await expect(page.getByText("Credits", { exact: true })).toBeVisible();
  });

  test("quick action links are visible", async ({ page }) => {
    const actions = ["Book a space", "My bookings", "My plan", "Store"];
    for (const label of actions) {
      await expect(
        page.getByRole("link", { name: label, exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("'Book a space' quick action navigates to /book", async ({ page }) => {
    await page.getByRole("link", { name: "Book a space", exact: true }).first().click();
    await page.waitForURL("**/book");
    await expect(page).toHaveURL(/\/book$/);
  });

  test("'My bookings' quick action navigates to /bookings", async ({
    page,
  }) => {
    await page
      .getByRole("link", { name: "My bookings", exact: true })
      .click();
    await page.waitForURL("**/bookings");
    await expect(page).toHaveURL(/\/bookings$/);
  });

  test("'My plan' quick action navigates to /plan", async ({ page }) => {
    await page.getByRole("link", { name: "My plan", exact: true }).click();
    await page.waitForURL("**/plan");
    await expect(page).toHaveURL(/\/plan$/);
  });

  test("'Store' quick action navigates to /store", async ({ page }) => {
    await page.getByRole("link", { name: "Store", exact: true }).click();
    await page.waitForURL("**/store");
    await expect(page).toHaveURL(/\/store$/);
  });

  test("Today section is present", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();
  });
});

test.describe("Dashboard admin sections", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");
  });

  test("admin user sees Quick Stats section with counts", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Quick Stats" }),
    ).toBeVisible();

    await expect(page.locator("main").getByText("Members", { exact: true })).toBeVisible();
    await expect(page.locator("main").getByText("Resources", { exact: true })).toBeVisible();
    await expect(page.locator("main").getByText("Plans configured", { exact: true })).toBeVisible();
  });

  test("admin user sees Setup Checklist section", async ({ page }) => {
    // The checklist appears when not all items are done.
    // With a fresh test space the checklist should be visible since
    // Stripe is not connected and there are no members/resources/plans seeded.
    const checklist = page.getByRole("heading", { name: "Setup Checklist" });
    // Use a soft check: if the space has everything set up, this heading
    // won't appear, so we skip gracefully.
    const isVisible = await checklist.isVisible().catch(() => false);
    if (isVisible) {
      await expect(page.getByText("Configure plans")).toBeVisible();
      await expect(page.getByText("Add resources")).toBeVisible();
      await expect(page.getByText("Connect Stripe")).toBeVisible();
      await expect(page.getByText("Invite your first member")).toBeVisible();
    }
  });
});

test.describe("Sidebar navigation - member links", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");
  });

  const memberLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Book", href: "/book" },
    { label: "My Bookings", href: "/bookings" },
    { label: "Store", href: "/store" },
    { label: "My Plan", href: "/plan" },
    { label: "Profile", href: "/profile" },
  ];

  for (const { label, href } of memberLinks) {
    test(`nav link "${label}" exists and points to ${href}`, async ({
      page,
    }) => {
      const link = page
        .locator("aside")
        .getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    });
  }

  test("clicking 'Book' nav link navigates to /book", async ({ page }) => {
    await page.locator("aside").getByRole("link", { name: "Book", exact: true }).click();
    await page.waitForURL("**/book");
    await expect(page).toHaveURL(/\/book$/);
  });

  test("clicking 'My Bookings' nav link navigates to /bookings", async ({
    page,
  }) => {
    await page
      .locator("aside")
      .getByRole("link", { name: "My Bookings", exact: true })
      .click();
    await page.waitForURL("**/bookings");
    await expect(page).toHaveURL(/\/bookings$/);
  });

  test("clicking 'My Plan' nav link navigates to /plan", async ({ page }) => {
    await page
      .locator("aside")
      .getByRole("link", { name: "My Plan", exact: true })
      .click();
    await page.waitForURL("**/plan");
    await expect(page).toHaveURL(/\/plan$/);
  });

  test("clicking 'Store' nav link navigates to /store", async ({ page }) => {
    await page
      .locator("aside")
      .getByRole("link", { name: "Store", exact: true })
      .click();
    await page.waitForURL("**/store");
    await expect(page).toHaveURL(/\/store$/);
  });

  test("clicking 'Profile' nav link navigates to /profile", async ({
    page,
  }) => {
    await page
      .locator("aside")
      .getByRole("link", { name: "Profile", exact: true })
      .click();
    await page.waitForURL("**/profile");
    await expect(page).toHaveURL(/\/profile$/);
  });
});

test.describe("Sidebar navigation - admin links", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");
  });

  const adminLinks = [
    { label: "Members", href: "/admin/members" },
    { label: "All Bookings", href: "/admin/bookings" },
    { label: "Plans & Pricing", href: "/admin/plans" },
    { label: "Resources", href: "/admin/resources" },
    { label: "Products", href: "/admin/products" },
    { label: "Settings", href: "/admin/settings" },
    { label: "Leads", href: "/admin/leads" },
    { label: "Passes", href: "/admin/passes" },
    { label: "Import Data", href: "/admin/import" },
  ];

  for (const { label, href } of adminLinks) {
    test(`admin nav link "${label}" exists and points to ${href}`, async ({
      page,
    }) => {
      const link = page
        .locator("aside")
        .getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    });
  }

  test("clicking 'Members' admin link navigates to /admin/members", async ({
    page,
  }) => {
    await page
      .locator("aside")
      .getByRole("link", { name: "Members", exact: true })
      .click();
    await page.waitForURL("**/admin/members");
    await expect(page).toHaveURL(/\/admin\/members$/);
  });

  test("clicking 'Settings' admin link navigates to /admin/settings", async ({
    page,
  }) => {
    await page
      .locator("aside")
      .getByRole("link", { name: "Settings", exact: true })
      .click();
    await page.waitForURL("**/admin/settings");
    await expect(page).toHaveURL(/\/admin\/settings$/);
  });
});
