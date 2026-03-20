import { describe, expect, it } from "vitest";
import { parseCSV, slugify } from "./csv";

// ── parseCSV ──────────────────────────────────────────────────────────────

describe("parseCSV", () => {
  it("parses simple CSV with headers and rows", () => {
    const result = parseCSV("Name,Email,Role\nAlice,alice@example.com,Admin\nBob,bob@example.com,Member");
    expect(result.headers).toEqual(["Name", "Email", "Role"]);
    expect(result.rows).toEqual([
      { Name: "Alice", Email: "alice@example.com", Role: "Admin" },
      { Name: "Bob", Email: "bob@example.com", Role: "Member" },
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    const result = parseCSV('Name,Address\n"Doe, Jane","123 Main St, Suite 4"');
    expect(result.rows).toEqual([
      { Name: "Doe, Jane", Address: "123 Main St, Suite 4" },
    ]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    const result = parseCSV('Name,Note\nAlice,"She said ""hello"""\nBob,Normal');
    expect(result.rows[0]).toEqual({
      Name: "Alice",
      Note: 'She said "hello"',
    });
    expect(result.rows[1]).toEqual({ Name: "Bob", Note: "Normal" });
  });

  it("handles embedded newlines inside quoted fields", () => {
    const result = parseCSV('Name,Bio\n"Alice","Line 1\nLine 2"\nBob,Simple');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ Name: "Alice", Bio: "Line 1\nLine 2" });
    expect(result.rows[1]).toEqual({ Name: "Bob", Bio: "Simple" });
  });

  it("strips UTF-8 BOM from the beginning", () => {
    const bom = "\uFEFF";
    const result = parseCSV(bom + "Name,Email\nAlice,alice@example.com");
    expect(result.headers).toEqual(["Name", "Email"]);
    expect(result.rows).toHaveLength(1);
  });

  it("handles Windows-style CRLF line endings", () => {
    const result = parseCSV("Name,Email\r\nAlice,alice@example.com\r\nBob,bob@example.com");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ Name: "Alice", Email: "alice@example.com" });
    expect(result.rows[1]).toEqual({ Name: "Bob", Email: "bob@example.com" });
  });

  it("handles standalone CR line endings", () => {
    const result = parseCSV("Name,Email\rAlice,alice@example.com\rBob,bob@example.com");
    expect(result.rows).toHaveLength(2);
  });

  it("returns empty result for empty input", () => {
    const result = parseCSV("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("returns headers-only when there are no data rows", () => {
    const result = parseCSV("Name,Email,Role");
    expect(result.headers).toEqual(["Name", "Email", "Role"]);
    expect(result.rows).toEqual([]);
  });

  it("fills missing values with empty strings when a row is shorter than headers", () => {
    const result = parseCSV("Name,Email,Role\nAlice");
    expect(result.rows[0]).toEqual({ Name: "Alice", Email: "", Role: "" });
  });

  it("trims whitespace from unquoted fields", () => {
    const result = parseCSV("Name , Email\n  Alice  ,  alice@example.com  ");
    expect(result.headers).toEqual(["Name", "Email"]);
    expect(result.rows[0]).toEqual({ Name: "Alice", Email: "alice@example.com" });
  });

  it("filters out empty trailing rows", () => {
    const result = parseCSV("Name,Email\nAlice,alice@example.com\n\n\n");
    expect(result.rows).toHaveLength(1);
  });

  it("handles a realistic OfficeRnd-style import", () => {
    const csv = [
      "First Name,Last Name,Email,Plan,Start Date",
      "Maria,Garcia,maria.garcia@cowork.io,Hot Desk,2026-01-15",
      "James,Chen,james.chen@cowork.io,Dedicated Desk,2026-02-01",
      '"O\'Brien, Jr.",Patrick,patrick@cowork.io,Meeting Room,2026-03-01',
    ].join("\n");

    const result = parseCSV(csv);
    expect(result.headers).toEqual(["First Name", "Last Name", "Email", "Plan", "Start Date"]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]["First Name"]).toBe("Maria");
    expect(result.rows[2]["First Name"]).toBe("O'Brien, Jr.");
  });
});

// ── slugify ──────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts a simple name to lowercase with underscores", () => {
    expect(slugify("Hot Desk")).toBe("hot_desk");
  });

  it("strips leading and trailing underscores", () => {
    expect(slugify("  Hot Desk  ")).toBe("hot_desk");
  });

  it("collapses multiple non-alphanumeric characters into a single underscore", () => {
    expect(slugify("Meeting Room - Large")).toBe("meeting_room_large");
  });

  it("handles names with special characters", () => {
    expect(slugify("Café & Lounge")).toBe("caf_lounge");
  });

  it("handles already-clean slugs", () => {
    expect(slugify("desk")).toBe("desk");
  });

  it("handles single character", () => {
    expect(slugify("A")).toBe("a");
  });

  it("handles numbers", () => {
    expect(slugify("Room 42")).toBe("room_42");
  });

  it("returns empty string for non-alphanumeric-only input", () => {
    expect(slugify("---")).toBe("");
  });
});
