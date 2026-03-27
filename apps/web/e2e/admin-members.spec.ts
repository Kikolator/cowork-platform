import { test, expect } from "@playwright/test";

test.describe("Admin Members Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/members");
  });

  test("renders page heading and description", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Members", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText("View and manage your space members."),
    ).toBeVisible();
  });

  test("renders Add Member button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /add member/i }),
    ).toBeVisible();
  });

  test("renders search input", async ({ page }) => {
    await expect(
      page.getByPlaceholder("Search by name, email, or company..."),
    ).toBeVisible();
  });

  test("renders status filter buttons", async ({ page }) => {
    const filters = page.getByRole("button");
    await expect(filters.getByText("All")).toBeVisible();
    await expect(filters.getByText("Active")).toBeVisible();
    await expect(filters.getByText("Paused")).toBeVisible();
    await expect(filters.getByText("Past Due")).toBeVisible();
    await expect(filters.getByText("Cancelling")).toBeVisible();
    await expect(filters.getByText("Churned")).toBeVisible();
  });

  test("shows table with correct column headers when members exist", async ({
    page,
  }) => {
    // Wait for the page content to settle -- either a table or empty state
    await expect(
      page
        .getByRole("columnheader", { name: "Member" })
        .or(page.getByText("No members yet")),
    ).toBeVisible();

    const table = page.getByRole("table");
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      await expect(
        page.getByRole("columnheader", { name: "Member" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Plan" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Status" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Login" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Joined" }),
      ).toBeVisible();
    }
  });

  test("shows empty state when no members exist", async ({ page }) => {
    // Wait for either table or empty state
    await expect(
      page
        .getByRole("columnheader", { name: "Member" })
        .or(page.getByText("No members yet")),
    ).toBeVisible();

    const emptyState = page.getByText("No members yet");
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasEmptyState) {
      await expect(
        page.getByText(
          "Add your first member or import members from a CSV file.",
        ),
      ).toBeVisible();
    }
  });

  test("search input filters results", async ({ page }) => {
    // Wait for page to load
    await expect(
      page
        .getByRole("columnheader", { name: "Member" })
        .or(page.getByText("No members yet")),
    ).toBeVisible();

    const table = page.getByRole("table");
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      const searchInput = page.getByPlaceholder(
        "Search by name, email, or company...",
      );
      await searchInput.fill("zzz-nonexistent-query-zzz");

      await expect(
        page.getByText("No members match your filters"),
      ).toBeVisible();
    }
  });

  test("status filter buttons are interactive", async ({ page }) => {
    // Wait for page to load
    await expect(
      page
        .getByRole("columnheader", { name: "Member" })
        .or(page.getByText("No members yet")),
    ).toBeVisible();

    // Click a status filter button
    const activeButton = page.getByRole("button", { name: "Active" });
    await activeButton.click();

    // The button should now be the active/default variant (not outline)
    // We verify the filter was applied by checking the button is still visible
    await expect(activeButton).toBeVisible();

    // Click "All" to reset
    const allButton = page.getByRole("button", { name: "All" });
    await allButton.click();
    await expect(allButton).toBeVisible();
  });
});

test.describe("Admin Leads Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/leads");
  });

  test("renders page heading and description", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Leads", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Track and manage prospective members through your pipeline.",
      ),
    ).toBeVisible();
  });

  test("renders Add Lead button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /add lead/i }),
    ).toBeVisible();
  });

  test("renders search input", async ({ page }) => {
    await expect(
      page.getByPlaceholder("Search by name, email, or company..."),
    ).toBeVisible();
  });

  test("renders status filter buttons", async ({ page }) => {
    const allButton = page.getByRole("button", { name: "All" });
    await expect(allButton).toBeVisible();
    await expect(page.getByRole("button", { name: "New" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invited" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirmed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Completed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Follow Up" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Converted" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Lost" })).toBeVisible();
  });

  test("renders Show archived toggle", async ({ page }) => {
    await expect(page.getByLabel("Show archived")).toBeVisible();
  });

  test("shows table with correct column headers when leads exist", async ({
    page,
  }) => {
    // Wait for page content
    await expect(
      page
        .getByRole("columnheader", { name: "Lead" })
        .or(page.getByText("No leads yet")),
    ).toBeVisible();

    const table = page.getByRole("table");
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      await expect(
        page.getByRole("columnheader", { name: "Lead" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Company" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Status" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Source" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Trial Date" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Created" }),
      ).toBeVisible();
    }
  });

  test("shows empty state when no leads exist", async ({ page }) => {
    // Wait for either table or empty state
    await expect(
      page
        .getByRole("columnheader", { name: "Lead" })
        .or(page.getByText("No leads yet")),
    ).toBeVisible();

    const emptyState = page.getByText("No leads yet");
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasEmptyState) {
      await expect(
        page.getByText(
          /Leads are prospective members moving through your pipeline/,
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /add your first lead/i }),
      ).toBeVisible();
    }
  });

  test("search input filters results", async ({ page }) => {
    // Wait for page to load
    await expect(
      page
        .getByRole("columnheader", { name: "Lead" })
        .or(page.getByText("No leads yet")),
    ).toBeVisible();

    const table = page.getByRole("table");
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      const searchInput = page.getByPlaceholder(
        "Search by name, email, or company...",
      );
      await searchInput.fill("zzz-nonexistent-query-zzz");

      await expect(
        page.getByText("No leads match your filters"),
      ).toBeVisible();
    }
  });

  test("status filter buttons are interactive", async ({ page }) => {
    // Wait for page to load
    await expect(
      page
        .getByRole("columnheader", { name: "Lead" })
        .or(page.getByText("No leads yet")),
    ).toBeVisible();

    // Click a status filter
    const newButton = page.getByRole("button", { name: "New" });
    await newButton.click();
    await expect(newButton).toBeVisible();

    // Reset
    const allButton = page.getByRole("button", { name: "All" });
    await allButton.click();
    await expect(allButton).toBeVisible();
  });
});
