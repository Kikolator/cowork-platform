import { test, expect } from "@playwright/test";

test.describe("Book a Resource page (/book)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/book");
    await page.waitForURL("**/book");
  });

  test("renders the page heading and description", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Book a Resource" }),
    ).toBeVisible();
    await expect(
      page.getByText("Select a resource type to make a booking."),
    ).toBeVisible();
  });

  test("shows resource type cards with links", async ({ page }) => {
    // The page should show at least one resource type card, or the empty state.
    const deskLink = page.getByRole("link", { name: /book a desk/i });
    const roomLink = page.getByRole("link", { name: /book a room/i });
    const emptyState = page.getByText("No bookable resources");

    // Either resource cards or empty state should be visible
    const hasDesk = await deskLink.isVisible().catch(() => false);
    const hasRoom = await roomLink.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasDesk || hasRoom || hasEmpty).toBe(true);
  });

  test("desk card navigates to /book/desk", async ({ page }) => {
    const deskLink = page.getByRole("link", { name: /book a desk/i });

    // Skip if no desk resource type is configured
    if (!(await deskLink.isVisible().catch(() => false))) {
      test.skip(true, "No desk resource type configured in test data");
      return;
    }

    await deskLink.click();
    await page.waitForURL("**/book/desk");
    expect(page.url()).toContain("/book/desk");
  });

  test("room card navigates to /book/room", async ({ page }) => {
    const roomLink = page.getByRole("link", { name: /book a room/i });

    // Skip if no room resource type is configured
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
  test("renders the desk booking page heading", async ({ page }) => {
    await page.goto("/book/desk");

    // The page shows either "Book a Desk" (normal flow) or "Desk Booking" (fixed desk)
    // or redirects to /store (non-member) or /login (unauthenticated)
    const bookDeskHeading = page.getByRole("heading", {
      name: /book a desk|desk booking/i,
    });
    const storeRedirect = page.url().includes("/store");
    const loginRedirect = page.url().includes("/login");

    if (storeRedirect || loginRedirect) {
      test.skip(
        true,
        "Test user redirected (non-member or unauthenticated)",
      );
      return;
    }

    await expect(bookDeskHeading).toBeVisible();
  });

  test("shows desk credits information", async ({ page }) => {
    await page.goto("/book/desk");

    // Skip if redirected away
    if (!page.url().includes("/book/desk")) {
      test.skip(true, "Redirected away from desk booking page");
      return;
    }

    // Should show credit balance section
    await expect(page.getByText("Desk credits")).toBeVisible();
  });
});

test.describe("Room Selection page (/book/room)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/book/room");
    await page.waitForURL("**/book/room");
  });

  test("renders the room selection heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Book a Room" }),
    ).toBeVisible();
    await expect(
      page.getByText("Select a room to view available time slots."),
    ).toBeVisible();
  });

  test("shows room cards or empty state", async ({ page }) => {
    // Either room cards with "View Availability" links, or empty state
    const roomLinks = page.getByText("View Availability");
    const emptyState = page.getByText("No rooms available");

    const hasRooms =
      (await roomLinks.count().catch(() => 0)) > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasRooms || hasEmpty).toBe(true);
  });

  test("room card navigates to individual room page", async ({ page }) => {
    const viewAvailLinks = page.getByText("View Availability");
    const count = await viewAvailLinks.count();

    if (count === 0) {
      test.skip(true, "No rooms configured in test data");
      return;
    }

    // Click the first room card (the link wrapping the card)
    const firstRoomLink = page
      .getByRole("link")
      .filter({ hasText: "View Availability" })
      .first();
    await firstRoomLink.click();

    await page.waitForURL("**/book/room/*");
    expect(page.url()).toMatch(/\/book\/room\/[a-f0-9-]+/);
  });
});

test.describe("Individual Room Booking page (/book/room/[resourceId])", () => {
  test("renders room details when navigated from room list", async ({
    page,
  }) => {
    // Navigate to room list first
    await page.goto("/book/room");
    await page.waitForURL("**/book/room");

    const firstRoomLink = page
      .getByRole("link")
      .filter({ hasText: "View Availability" })
      .first();

    if (!(await firstRoomLink.isVisible().catch(() => false))) {
      test.skip(true, "No rooms configured in test data");
      return;
    }

    await firstRoomLink.click();
    await page.waitForURL("**/book/room/*");

    // The page should show the room name as a heading
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
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
    const bookButton = page.getByRole("link", { name: /book/i });
    await expect(bookButton).toBeVisible();
    await expect(bookButton).toHaveAttribute("href", "/book");
  });

  test("Book button navigates to /book", async ({ page }) => {
    const bookButton = page.getByRole("link", { name: /book/i });
    await bookButton.click();
    await page.waitForURL("**/book");
    expect(page.url()).toContain("/book");
  });

  test("shows upcoming bookings section or empty state", async ({ page }) => {
    // Either the "Upcoming" heading or the "No upcoming bookings" empty state
    const upcomingHeading = page.getByRole("heading", { name: "Upcoming" });
    const emptyState = page.getByText("No upcoming bookings");

    const hasUpcoming = await upcomingHeading.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasUpcoming || hasEmpty).toBe(true);
  });
});

test.describe("Booking flow navigation", () => {
  test("can navigate from bookings to book and back", async ({ page }) => {
    // Start at My Bookings
    await page.goto("/bookings");
    await page.waitForURL("**/bookings");
    await expect(
      page.getByRole("heading", { name: "My Bookings" }),
    ).toBeVisible();

    // Click Book button to go to /book
    const bookButton = page.getByRole("link", { name: /book/i });
    await bookButton.click();
    await page.waitForURL("**/book");
    await expect(
      page.getByRole("heading", { name: "Book a Resource" }),
    ).toBeVisible();
  });

  test("can navigate from /book to desk booking via card", async ({
    page,
  }) => {
    await page.goto("/book");
    await page.waitForURL("**/book");

    const deskLink = page.getByRole("link", { name: /book a desk/i });
    if (!(await deskLink.isVisible().catch(() => false))) {
      test.skip(true, "No desk resource type configured");
      return;
    }

    await deskLink.click();
    await page.waitForURL("**/book/desk");

    const heading = page.getByRole("heading", {
      name: /book a desk|desk booking/i,
    });
    // May redirect to /store if non-member, which is expected behavior
    if (page.url().includes("/book/desk")) {
      await expect(heading).toBeVisible();
    }
  });

  test("can navigate from /book to room selection via card", async ({
    page,
  }) => {
    await page.goto("/book");
    await page.waitForURL("**/book");

    const roomLink = page.getByRole("link", { name: /book a room/i });
    if (!(await roomLink.isVisible().catch(() => false))) {
      test.skip(true, "No room resource type configured");
      return;
    }

    await roomLink.click();
    await page.waitForURL("**/book/room");
    await expect(
      page.getByRole("heading", { name: "Book a Room" }),
    ).toBeVisible();
  });
});
