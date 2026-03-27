import { test, expect } from "@playwright/test";

test.describe("Admin Plans page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/plans");
    // Wait for the page heading to confirm the page has loaded
    await expect(
      page.getByRole("heading", { name: /plans & pricing/i }),
    ).toBeVisible();
  });

  test("renders the page heading and description", async ({ page }) => {
    await expect(
      page.getByText(
        /define membership tiers and credit allowances for your space/i,
      ),
    ).toBeVisible();
  });

  test("shows the Create Plan button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /create plan/i }),
    ).toBeVisible();
  });

  test("shows empty state when no plans exist", async ({ page }) => {
    // The empty state is shown when there are no plans in the database.
    // Since seed data does not include plans, this should be the default.
    const emptyHeading = page.getByText("No plans yet");
    const hasEmptyState = await emptyHeading.isVisible().catch(() => false);

    if (hasEmptyState) {
      await expect(emptyHeading).toBeVisible();
      await expect(
        page.getByText(/create your first plan to start accepting members/i),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /create your first plan/i }),
      ).toBeVisible();
    } else {
      // Plans exist (seeded or from prior test runs) -- verify the table is shown
      await expect(page.getByRole("table")).toBeVisible();
    }
  });

  test("shows plan table with column headers when plans exist", async ({
    page,
  }) => {
    // If plans exist, verify the table structure
    const table = page.getByRole("table");
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      await expect(
        page.getByRole("columnheader", { name: /plan/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /price/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /access/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /credits/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /active/i }),
      ).toBeVisible();
    } else {
      // Empty state -- already covered by other test, just confirm page loaded
      await expect(page.getByText("No plans yet")).toBeVisible();
    }
  });

  test("opens create plan dialog when clicking Create Plan", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /create plan/i }).first().click();

    // The PlanForm dialog should open
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("create plan dialog contains expected form fields", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /create plan/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Dialog title and description
    await expect(
      dialog.getByRole("heading", { name: /create plan/i }),
    ).toBeVisible();
    await expect(
      dialog.getByText(/set up a new membership tier for your space/i),
    ).toBeVisible();

    // Basics section
    await expect(dialog.getByLabel("Name")).toBeVisible();
    await expect(dialog.getByLabel("Slug")).toBeVisible();
    await expect(dialog.getByLabel(/description/i)).toBeVisible();

    // Pricing section
    await expect(dialog.getByLabel(/monthly price/i)).toBeVisible();
    await expect(dialog.getByLabel(/tax rate/i)).toBeVisible();

    // Access section
    await expect(dialog.getByLabel(/access level/i)).toBeVisible();
    await expect(dialog.getByText(/fixed desk included/i)).toBeVisible();

    // Footer buttons
    await expect(
      dialog.getByRole("button", { name: /cancel/i }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /create plan/i }),
    ).toBeVisible();
  });

  test("create plan dialog can be closed with Cancel", async ({ page }) => {
    await page.getByRole("button", { name: /create plan/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("empty state Create your first plan button opens dialog", async ({
    page,
  }) => {
    const emptyButton = page.getByRole("button", {
      name: /create your first plan/i,
    });
    const hasEmptyState = await emptyButton.isVisible().catch(() => false);

    if (hasEmptyState) {
      await emptyButton.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("heading", { name: /create plan/i }),
      ).toBeVisible();
    }
  });
});

test.describe("Admin Resources page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/resources");
    // Wait for the page heading to confirm the page has loaded
    await expect(
      page.getByRole("heading", { name: /^resources$/i }),
    ).toBeVisible();
  });

  test("renders the page heading and summary", async ({ page }) => {
    // The summary line shows counts: "N resources across M types"
    await expect(
      page.getByText(/\d+ resources across \d+ types/i),
    ).toBeVisible();
  });

  test("shows the Add Resource Type button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /add resource type/i }),
    ).toBeVisible();
  });

  test("shows empty state when no resource types exist", async ({ page }) => {
    const emptyHeading = page.getByText("No resource types configured");
    const hasEmptyState = await emptyHeading.isVisible().catch(() => false);

    if (hasEmptyState) {
      await expect(emptyHeading).toBeVisible();
      await expect(
        page.getByText(
          /resource types define categories like desks, meeting rooms/i,
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /add your first resource type/i }),
      ).toBeVisible();
    } else {
      // Resource types exist -- verify at least one group heading is rendered
      const headings = page.getByRole("heading", { level: 3 });
      await expect(headings.first()).toBeVisible();
    }
  });

  test("displays resource type groups when resource types exist", async ({
    page,
  }) => {
    const emptyHeading = page.getByText("No resource types configured");
    const hasEmptyState = await emptyHeading.isVisible().catch(() => false);

    if (!hasEmptyState) {
      // Each resource type group has an "Edit Type" button
      await expect(
        page.getByRole("button", { name: /edit type/i }).first(),
      ).toBeVisible();

      // Each resource type group has an "Add <TypeName>" button
      const addButtons = page.getByRole("button", { name: /^add /i });
      // Filter out the "Add Resource Type" button at the top
      const groupAddButton = addButtons.filter({
        hasNot: page.getByText(/resource type/i),
      });
      await expect(groupAddButton.first()).toBeVisible();
    } else {
      // Just confirm empty state is shown
      await expect(emptyHeading).toBeVisible();
    }
  });

  test("opens add resource type dialog when clicking Add Resource Type", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /add resource type/i })
      .first()
      .click();

    // The ResourceTypeForm dialog should open
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("add resource type dialog contains expected form fields", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /add resource type/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Dialog title and description
    await expect(
      dialog.getByRole("heading", { name: /add resource type/i }),
    ).toBeVisible();
    await expect(
      dialog.getByText(/create a new category for your bookable resources/i),
    ).toBeVisible();

    // Form fields
    await expect(dialog.getByLabel("Name")).toBeVisible();
    await expect(dialog.getByLabel("Slug")).toBeVisible();
    await expect(dialog.getByText("Bookable", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Billable", { exact: true })).toBeVisible();

    // Footer buttons
    await expect(
      dialog.getByRole("button", { name: /cancel/i }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /create/i }),
    ).toBeVisible();
  });

  test("add resource type dialog can be closed with Cancel", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /add resource type/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("empty state Add your first resource type button opens dialog", async ({
    page,
  }) => {
    const emptyButton = page.getByRole("button", {
      name: /add your first resource type/i,
    });
    const hasEmptyState = await emptyButton.isVisible().catch(() => false);

    if (hasEmptyState) {
      await emptyButton.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("heading", { name: /add resource type/i }),
      ).toBeVisible();
    }
  });

  test("resource type groups show resource table when resources exist", async ({
    page,
  }) => {
    const emptyHeading = page.getByText("No resource types configured");
    const hasEmptyState = await emptyHeading.isVisible().catch(() => false);

    if (!hasEmptyState) {
      // Check if any resource table exists within the groups
      const tables = page.getByRole("table");
      const hasTable = await tables.first().isVisible().catch(() => false);

      if (hasTable) {
        // Verify table has Name column header
        await expect(
          page.getByRole("columnheader", { name: /name/i }).first(),
        ).toBeVisible();
        // Verify table has Floor column header
        await expect(
          page.getByRole("columnheader", { name: /floor/i }).first(),
        ).toBeVisible();
        // Verify table has Status column header
        await expect(
          page.getByRole("columnheader", { name: /status/i }).first(),
        ).toBeVisible();
      }
    }
  });
});
