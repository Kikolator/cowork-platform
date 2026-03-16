/**
 * Lightweight CSV parser for OfficeRnd data imports.
 * Handles quoted fields, embedded commas/newlines, and BOM stripping.
 * Runs client-side for instant preview without server round-trips.
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/** Strip UTF-8 BOM if present */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parse CSV text into headers + row objects.
 * Supports RFC 4180: quoted fields, embedded commas, embedded newlines.
 */
export function parseCSV(text: string): ParsedCSV {
  const cleaned = stripBom(text);
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < cleaned.length) {
    const ch = cleaned[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < cleaned.length && cleaned[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        current.push(field.trim());
        field = "";
        i++;
      } else if (ch === "\r") {
        // Handle \r\n or standalone \r
        current.push(field.trim());
        field = "";
        rows.push(current);
        current = [];
        i += i + 1 < cleaned.length && cleaned[i + 1] === "\n" ? 2 : 1;
      } else if (ch === "\n") {
        current.push(field.trim());
        field = "";
        rows.push(current);
        current = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push last field/row
  if (field || current.length > 0) {
    current.push(field.trim());
    rows.push(current);
  }

  // Filter out empty rows
  const nonEmpty = rows.filter(
    (r) => r.length > 1 || (r.length === 1 && r[0] !== ""),
  );

  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = nonEmpty[0];
  const dataRows = nonEmpty.slice(1).map((values) => {
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ?? "";
    }
    return obj;
  });

  return { headers, rows: dataRows };
}

/** Generate a URL-safe slug from a display name */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
