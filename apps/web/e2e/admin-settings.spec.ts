import { test, expect } from "@playwright/test";

test.describe("Admin Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Space Settings" }),
    ).toBeVisible();
  });

  test("renders page heading and subtext", async ({ page }) => {
    await expect(page.getByText("Manage your space configuration.")).toBeVisible();
  });

  test("displays all five tabs", async ({ page }) => {
    const tabList = page.getByRole("tablist");
    await expect(tabList).toBeVisible();

    await expect(tabList.getByRole("tab", { name: "Branding" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Operations" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Fiscal" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Features" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Payments" })).toBeVisible();
  });

  test("defaults to Branding tab selected", async ({ page }) => {
    const brandingTab = page.getByRole("tab", { name: "Branding" });
    await expect(brandingTab).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Admin Settings - Branding Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Space Settings" }),
    ).toBeVisible();
  });

  test("renders branding form with expected fields", async ({ page }) => {
    await expect(page.getByLabel("Space name")).toBeVisible();
    await expect(page.getByLabel("Slug")).toBeVisible();
    await expect(page.getByLabel("Primary color")).toBeVisible();
    await expect(page.getByLabel("Accent color")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Branding" }),
    ).toBeVisible();
  });

  test("renders image upload sections for logo, dark logo, and favicon", async ({ page }) => {
    await expect(page.getByText("Logo", { exact: false })).toBeVisible();
    await expect(page.getByText("Dark Mode Logo")).toBeVisible();
    await expect(page.getByText("Favicon")).toBeVisible();
  });

  test("space name field is pre-populated", async ({ page }) => {
    const nameInput = page.getByLabel("Space name");
    await expect(nameInput).toBeVisible();
    // The field should have a value (populated from the space record)
    await expect(nameInput).not.toHaveValue("");
  });

  test("slug field shows URL change warning", async ({ page }) => {
    await expect(
      page.getByText("Changing the slug changes your workspace URL."),
    ).toBeVisible();
  });
});

test.describe("Admin Settings - Tab Navigation via URL", () => {
  test("navigates to Operations tab via ?tab=operations", async ({ page }) => {
    await page.goto("/admin/settings?tab=operations");
    await expect(
      page.getByRole("heading", { name: "Space Settings" }),
    ).toBeVisible();

    const operationsTab = page.getByRole("tab", { name: "Operations" });
    await expect(operationsTab).toHaveAttribute("aria-selected", "true");

    // Operations form content
    await expect(page.getByText("Timezone")).toBeVisible();
    await expect(page.getByText("Currency")).toBeVisible();
    await expect(page.getByText("Business Hours")).toBeVisible();
    await expect(page.getByText("Default locale")).toBeVisible();
    await expect(page.getByText("Minimum booking time")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Operations" }),
    ).toBeVisible();
  });

  test("navigates to Fiscal tab via ?tab=fiscal", async ({ page }) => {
    await page.goto("/admin/settings?tab=fiscal");
    await expect(
      page.getByRole("heading", { name: "Space Settings" }),
    ).toBeVisible();

    const fiscalTab = page.getByRole("tab", { name: "Fiscal" });
    await expect(fiscalTab).toHaveAttribute("aria-selected", "true");

    // Fiscal form content
    await expect(
      page.getByText("Require fiscal ID for checkout"),
    ).toBeVisible();
    await expect(page.getByText("Supported ID types")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Fiscal Settings" }),
    ).toBeVisible();
  });

  test("navigates to Features tab via ?tab=features", async ({ page }) => {
    await page.goto("/admin/settings?tab=features");
    await expect(
      page.getByRole("heading", { name: "Space Settings" }),
    ).toBeVisible();

    const featuresTab = page.getByRole("tab", { name: "Features" });
    await expect(featuresTab).toHaveAttribute("aria-selected", "true");

    // Features form content - feature toggle labels
    const main = page.locator("main");
    await expect(main.getByText("Passes")).toBeVisible();
    await expect(main.getByText("Credits")).toBeVisible();
    await expect(main.getByText("Leads")).toBeVisible();
    await expect(main.getByText("Recurring Bookings")).toBeVisible();
    await expect(main.getByText("Guest Passes")).toBeVisible();
    await expect(main.getByText("Open Registration")).toBeVisible();
  });

  test("navigates to Payments tab via ?tab=payments", async ({ page }) => {
    await page.goto("/admin/settings?tab=payments");
    await expect(
      page.getByRole("heading", { name: "Space Settings" }),
    ).toBeVisible();

    const paymentsTab = page.getByRole("tab", { name: "Payments" });
    await expect(paymentsTab).toHaveAttribute("aria-selected", "true");

    // Stripe connect content - heading is always present regardless of connection state
    await expect(page.getByText("Stripe Payments")).toBeVisible();
  });

  test("invalid tab param falls back to Branding", async ({ page }) => {
    await page.goto("/admin/settings?tab=nonexistent");
    await expect(
      page.getByRole("heading", { name: "Space Settings" }),
    ).toBeVisible();

    const brandingTab = page.getByRole("tab", { name: "Branding" });
    await expect(brandingTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Space name")).toBeVisible();
  });
});

test.describe("Admin Settings - Tab Switching via Click", () => {
  test("can switch tabs by clicking", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Space Settings" }),
    ).toBeVisible();

    // Start on Branding (default)
    await expect(
      page.getByRole("tab", { name: "Branding" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Space name")).toBeVisible();

    // Click Operations tab
    await page.getByRole("tab", { name: "Operations" }).click();
    await expect(
      page.getByRole("tab", { name: "Operations" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Business Hours")).toBeVisible();

    // Click Fiscal tab
    await page.getByRole("tab", { name: "Fiscal" }).click();
    await expect(
      page.getByRole("tab", { name: "Fiscal" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Require fiscal ID for checkout")).toBeVisible();

    // Click Features tab
    await page.getByRole("tab", { name: "Features" }).click();
    await expect(
      page.getByRole("tab", { name: "Features" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("main").getByText("Passes")).toBeVisible();

    // Click Payments tab
    await page.getByRole("tab", { name: "Payments" }).click();
    await expect(
      page.getByRole("tab", { name: "Payments" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Stripe Payments")).toBeVisible();
  });
});

test.describe("Admin Settings - Operations Tab Content", () => {
  test("displays business hours grid with all weekdays", async ({ page }) => {
    await page.goto("/admin/settings?tab=operations");
    await expect(page.getByText("Business Hours")).toBeVisible();

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (const day of days) {
      await expect(page.getByText(day)).toBeVisible();
    }
  });

  test("displays business hours grid headers", async ({ page }) => {
    await page.goto("/admin/settings?tab=operations");
    await expect(page.getByText("Business Hours")).toBeVisible();

    await expect(page.getByText("Day")).toBeVisible();
    await expect(page.getByText("Open")).toBeVisible();
    await expect(page.getByText("Close")).toBeVisible();
    await expect(page.getByText("Closed")).toBeVisible();
  });

  test("shows minimum booking time description", async ({ page }) => {
    await page.goto("/admin/settings?tab=operations");
    await expect(
      page.getByText("Shortest duration a member can book."),
    ).toBeVisible();
  });
});

test.describe("Admin Settings - Fiscal Tab Content", () => {
  test("displays fiscal ID type checkboxes", async ({ page }) => {
    await page.goto("/admin/settings?tab=fiscal");
    await expect(page.getByText("Supported ID types")).toBeVisible();

    const idTypes = [
      "NIF (Spain)",
      "NIE (Spain)",
      "CIF (Spain)",
      "Passport",
      "EU VAT",
      "Foreign Tax ID",
      "Other",
    ];
    for (const idType of idTypes) {
      await expect(page.getByText(idType)).toBeVisible();
    }
  });

  test("displays fiscal ID requirement description", async ({ page }) => {
    await page.goto("/admin/settings?tab=fiscal");
    await expect(
      page.getByText(/members must provide a fiscal ID before completing any purchase/),
    ).toBeVisible();
  });
});

test.describe("Admin Settings - Features Tab Content", () => {
  test("displays feature descriptions", async ({ page }) => {
    await page.goto("/admin/settings?tab=features");
    await expect(
      page.getByRole("heading", { name: "Space Settings" }),
    ).toBeVisible();

    await expect(page.getByText("Allow day and week passes")).toBeVisible();
    await expect(page.getByText("Enable credit-based booking system")).toBeVisible();
    await expect(page.getByText("Enable lead pipeline and trial days")).toBeVisible();
    await expect(page.getByText("Allow members to set up recurring bookings")).toBeVisible();
    await expect(page.getByText("Allow members to purchase passes for guests")).toBeVisible();
    await expect(page.getByText(/Allow anyone to create an account/)).toBeVisible();
  });

  test("each feature has a toggle switch", async ({ page }) => {
    await page.goto("/admin/settings?tab=features");
    await expect(page.locator("main").getByText("Passes")).toBeVisible();

    // There should be 6 switch toggles (one per feature flag)
    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(6);
  });
});

test.describe("Admin Settings - Payments Tab Content", () => {
  test("shows Stripe connection info with connect button or connected status", async ({
    page,
  }) => {
    await page.goto("/admin/settings?tab=payments");
    await expect(page.getByText("Stripe Payments")).toBeVisible();

    // When not connected, should show a connect prompt
    // The exact state depends on seed data, but either:
    // - "Connect Stripe Account" button (not connected)
    // - "Complete Stripe Setup" button (connected, incomplete onboarding)
    // - "Connected" status (fully connected)
    const connectButton = page.getByRole("button", {
      name: /Connect Stripe Account|Complete Stripe Setup/,
    });
    const connectedStatus = page.getByText("Connected");

    // One of these states must be visible
    await expect(connectButton.or(connectedStatus).first()).toBeVisible();
  });

  test("shows Stripe redirect explanation when not connected", async ({ page }) => {
    await page.goto("/admin/settings?tab=payments");
    await expect(page.getByText("Stripe Payments")).toBeVisible();

    // If not connected, there should be an explanation about Stripe redirect
    const connectButton = page.getByRole("button", {
      name: "Connect Stripe Account",
    });
    const isNotConnected = await connectButton.isVisible().catch(() => false);

    if (isNotConnected) {
      await expect(
        page.getByText(/redirected to Stripe to complete setup/),
      ).toBeVisible();
    }
  });
});
