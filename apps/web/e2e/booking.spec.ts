import { test, expect } from "@playwright/test";

test.describe("Book a Resource page (/book)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/book");
    await page.waitForURL("**/book");
  });

  test("renders the page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Book a Resource" }),
    ).toBeVisible();
  });

  test("shows resource type cards or empty state", async ({ page }) => {
    const deskLink = page.getByRole("link", { name: /book a desk/i });
    const roomLink = page.getByRole("link", { name: /book a room/i });
    const emptyState = page.getByText("No bookable resources");

    const hasDesk = await deskLink.isVisible().catch(() => false);
    const hasRoom = await roomLink.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasDesk || hasRoom || hasEmpty).toBe(true);
  });

  test("desk card navigates to /book/desk when configured", async ({ page }) => {
    const deskLink = page.getByRole("link", { name: /book a desk/i });

    if (!(await deskLink.isVisible().catch(() => false))) {
      test.skip(true, "No desk resource type configured in test data");
      return;
    }

    await deskLink.click();
    await page.waitForURL("**/book/desk");
    expect(page.url()).toContain("/book/desk");
  });

  test("room card navigates to /book/room when configured", async ({ page }) => {
    const roomLink = page.getByRole("link", { name: /book a room/i });

    if (!(await roomLink.isVisible().catch(() => false))) {
      test.skip(true, "No room resource type configured in test data");
      return;
    }

    await roomLink.click();
    await page.waitForURL("**/book/room");
    expect(page.url()).toContain("/book/room");
  });
});

test.describe("Desk Booking page (/book/desk)", () => {
  test("renders the desk booking page or redirects gracefully", async ({
    page,
  }) => {
    await page.goto("/book/desk");
    // Wait for navigation to settle (may redirect to /store or /login)
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/store") || page.url().includes("/login")) {
      // Non-member or unauthenticated — redirect is expected
      test.skip(true, "Test user redirected (non-member or unauthenticated)");
      return;
    }

    await expect(
      page.getByRole("heading", { name: /book a desk|desk booking/i }),
    ).toBeVisible();
  });
});

test.describe("Room Selection page (/book/room)", () => {
  test("renders the room selection page when rooms exist", async ({
    page,
  }) => {
    await page.goto("/book/room");
    await page.waitForLoadState("networkidle");

    // If no room resource types exist, the page may redirect to /book
    if (!page.url().includes("/book/room")) {
      test.skip(true, "Redirected away from room selection page");
      return;
    }

    await expect(
      page.getByRole("heading", { name: "Book a Room" }),
    ).toBeVisible();
  });

  test("shows room cards or empty state", async ({ page }) => {
    await page.goto("/book/room");
    await page.waitForLoadState("networkidle");

    if (!page.url().includes("/book/room")) {
      test.skip(true, "Redirected away from room selection page");
      return;
    }

    const roomLinks = page.getByText("View Availability");
    const emptyState = page.getByText("No rooms available");

    const hasRooms = (await roomLinks.count().catch(() => 0)) > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasRooms || hasEmpty).toBe(true);
  });
});

test.describe("My Bookings page (/bookings)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/bookings");
    await page.waitForURL("**/bookings");
  });

  test("renders the page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "My Bookings" }),
    ).toBeVisible();
  });

  test("shows description text", async ({ page }) => {
    await expect(
      page.getByText("View and manage your upcoming and past bookings."),
    ).toBeVisible();
  });

  test("has a Book button linking to /book", async ({ page }) => {
    const bookButton = page
      .locator("main")
      .getByRole("link", { name: "Book", exact: true });
    await expect(bookButton).toBeVisible();
    await expect(bookButton).toHaveAttribute("href", "/book");
  });

  test("Book button navigates to /book", async ({ page }) => {
    const bookButton = page
      .locator("main")
      .getByRole("link", { name: "Book", exact: true });
    await bookButton.click();
    await page.waitForURL("**/book");
    expect(page.url()).toContain("/book");
  });

  test("shows upcoming bookings section or empty state", async ({ page }) => {
    const upcomingHeading = page.getByRole("heading", { name: "Upcoming" });
    const emptyState = page.getByText("No upcoming bookings");

    const hasUpcoming = await upcomingHeading.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasUpcoming || hasEmpty).toBe(true);
  });
});

test.describe("Booking flow navigation", () => {
  test("can navigate from bookings to book page", async ({ page }) => {
    await page.goto("/bookings");
    await page.waitForURL("**/bookings");
    await expect(
      page.getByRole("heading", { name: "My Bookings" }),
    ).toBeVisible();

    const bookButton = page
      .locator("main")
      .getByRole("link", { name: "Book", exact: true });
    await bookButton.click();
    await page.waitForURL("**/book");
    await expect(
      page.getByRole("heading", { name: "Book a Resource" }),
    ).toBeVisible();
  });
});
