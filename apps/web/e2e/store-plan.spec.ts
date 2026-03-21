import { test, expect } from "@playwright/test";

test.describe("Store Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/store");
  });

  test("renders with Store heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Store", level: 1 }),
    ).toBeVisible();
  });

  test("shows subtext describing available products", async ({ page }) => {
    await expect(
      page.getByText("Purchase passes, hour bundles, and add-ons."),
    ).toBeVisible();
  });

  test("shows product grid or empty state", async ({ page }) => {
    // Wait for the page to finish loading by checking the heading is present
    await expect(
      page.getByRole("heading", { name: "Store", level: 1 }),
    ).toBeVisible();

    // Either products are displayed (category headings like "Passes", "Hour Bundles", etc.)
    // or the empty state message is shown
    const emptyState = page.getByText("No products available.");
    const categoryHeading = page.getByRole("heading", { level: 2 }).first();

    await expect(emptyState.or(categoryHeading)).toBeVisible();
  });
});

test.describe("Plan Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/plan");
  });

  test("renders with appropriate heading", async ({ page }) => {
    // Heading is "My Plan" if user has an active plan, or "Choose a Plan" if not
    const myPlan = page.getByRole("heading", { name: "My Plan", level: 1 });
    const choosePlan = page.getByRole("heading", {
      name: "Choose a Plan",
      level: 1,
    });

    await expect(myPlan.or(choosePlan)).toBeVisible();
  });

  test("shows contextual subtext", async ({ page }) => {
    // Subtext varies depending on whether user has a plan
    const manageText = page.getByText(
      "Manage your subscription and view your credits.",
    );
    const selectText = page.getByText(
      "Select a plan to get started with your membership.",
    );

    await expect(manageText.or(selectText)).toBeVisible();
  });

  test("shows plan grid or empty state", async ({ page }) => {
    // Wait for page to load
    const myPlan = page.getByRole("heading", { name: "My Plan", level: 1 });
    const choosePlan = page.getByRole("heading", {
      name: "Choose a Plan",
      level: 1,
    });
    await expect(myPlan.or(choosePlan)).toBeVisible();

    // Either plans are rendered or the empty state
    const emptyState = page.getByText("No plans available yet.");
    const planGrid = page.locator("#plans");

    await expect(emptyState.or(planGrid)).toBeVisible();
  });

  test('shows current plan section when user has "My Plan" heading', async ({
    page,
  }) => {
    const myPlanHeading = page.getByRole("heading", {
      name: "My Plan",
      level: 1,
    });
    const choosePlanHeading = page.getByRole("heading", {
      name: "Choose a Plan",
      level: 1,
    });

    await expect(myPlanHeading.or(choosePlanHeading)).toBeVisible();

    // Only check current plan details if the user has an active plan
    if (await myPlanHeading.isVisible()) {
      // CurrentPlan component renders "Your Plan: <name>"
      await expect(
        page.getByRole("heading", { name: /Your Plan:/ }),
      ).toBeVisible();
    } else {
      // If no plan, the current plan section should not be present
      await expect(
        page.getByRole("heading", { name: /Your Plan:/ }),
      ).not.toBeVisible();
    }
  });
});

test.describe("Plan Success Page", () => {
  test("renders success state after subscription", async ({ page }) => {
    await page.goto("/plan/success");

    await expect(
      page.getByRole("heading", { name: "Welcome!" }),
    ).toBeVisible();

    await expect(
      page.getByText(
        "Your subscription is active. Credits have been added to your account.",
      ),
    ).toBeVisible();
  });

  test("shows navigation links", async ({ page }) => {
    await page.goto("/plan/success");

    await expect(
      page.getByRole("link", { name: "Go to Dashboard" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Book a Desk" }),
    ).toBeVisible();
  });
});

test.describe("Store Success Page", () => {
  test("renders success state after purchase", async ({ page }) => {
    await page.goto("/store/success");

    await expect(
      page.getByRole("heading", { name: "Payment Successful!" }),
    ).toBeVisible();

    await expect(
      page.getByText("Your purchase has been confirmed."),
    ).toBeVisible();
  });

  test("shows navigation links", async ({ page }) => {
    await page.goto("/store/success");

    await expect(
      page.getByRole("link", { name: "Back to Store" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to Dashboard" }),
    ).toBeVisible();
  });
});
