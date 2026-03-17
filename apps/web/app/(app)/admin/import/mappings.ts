/**
 * OfficeRnd CSV column → cowork-platform field mappings.
 * Used by the wizard to auto-detect columns from OfficeRnd Data Hub exports.
 */

export interface EntityMapping {
  displayName: string;
  /** OfficeRnd CSV header → platform field name */
  knownColumns: Record<string, string>;
  /** Platform fields that must be mapped for import to proceed */
  required: string[];
  /** All available platform fields the admin can map to */
  availableFields: { value: string; label: string }[];
}

export const IMPORT_ENTITIES = [
  "resources",
  "plans",
  "members",
  "bookings",
  "leads",
] as const;

export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

/** Internal-only mapping for teams CSV (used during member import, not a wizard step) */
export type MappableEntity = ImportEntity | "teams";

export const ENTITY_MAPPINGS: Record<ImportEntity, EntityMapping> = {
  resources: {
    displayName: "Resources",
    knownColumns: {
      Name: "name",
      name: "name",
      "Resource Name": "name",
      Type: "resource_type_name",
      type: "resource_type_name",
      "Resource Type": "resource_type_name",
      Floor: "floor",
      floor: "floor",
      Capacity: "capacity",
      capacity: "capacity",
      Status: "status",
      status: "status",
      _id: "external_id",
      Id: "external_id",
      id: "external_id",
    },
    required: ["name"],
    availableFields: [
      { value: "name", label: "Name" },
      { value: "resource_type_name", label: "Resource Type" },
      { value: "floor", label: "Floor" },
      { value: "capacity", label: "Capacity" },
      { value: "status", label: "Status" },
      { value: "external_id", label: "External ID" },
    ],
  },
  plans: {
    displayName: "Plans",
    knownColumns: {
      Name: "name",
      name: "name",
      Description: "description",
      description: "description",
      Type: "description",
      Price: "price",
      price: "price",
      "Price (monthly)": "price",
      Currency: "currency",
      currency: "currency",
      _id: "external_id",
      Id: "external_id",
      id: "external_id",
      ID: "external_id",
    },
    required: ["name"],
    availableFields: [
      { value: "name", label: "Name" },
      { value: "description", label: "Description" },
      { value: "price", label: "Price (decimal)" },
      { value: "currency", label: "Currency" },
      { value: "external_id", label: "External ID" },
    ],
  },
  members: {
    displayName: "Members",
    knownColumns: {
      Email: "email",
      email: "email",
      "Email Address": "email",
      Name: "full_name",
      name: "full_name",
      "Full Name": "full_name",
      "First Name": "first_name",
      "Last Name": "last_name",
      Company: "company",
      company: "company",
      "Business Name": "company",
      Phone: "phone",
      phone: "phone",
      "Phone Number": "phone",
      phoneNumber: "phone",
      Plan: "plan_name",
      plan: "plan_name",
      "Plan Name": "plan_name",
      Membership: "plan_name",
      Status: "status",
      status: "status",
      "Start Date": "joined_at",
      "Join Date": "joined_at",
      _id: "external_id",
      Id: "external_id",
      id: "external_id",
      ID: "external_id",
      VAT: "vat",
      "Reg Number": "reg_number",
      Address: "address",
      City: "city",
      Zip: "zip",
      Country: "country",
    },
    required: ["email"],
    availableFields: [
      { value: "email", label: "Email" },
      { value: "full_name", label: "Full Name" },
      { value: "first_name", label: "First Name" },
      { value: "last_name", label: "Last Name" },
      { value: "company", label: "Company" },
      { value: "phone", label: "Phone" },
      { value: "plan_name", label: "Plan Name" },
      { value: "status", label: "Status" },
      { value: "joined_at", label: "Join Date" },
      { value: "vat", label: "VAT Number" },
      { value: "reg_number", label: "Reg Number" },
      { value: "address", label: "Address" },
      { value: "city", label: "City" },
      { value: "zip", label: "Postal Code" },
      { value: "country", label: "Country" },
      { value: "external_id", label: "External ID" },
    ],
  },
  bookings: {
    displayName: "Bookings",
    knownColumns: {
      "Resource Name": "resource_name",
      Resource: "resource_name",
      resource: "resource_name",
      "Member Email": "member_email",
      Email: "member_email",
      email: "member_email",
      "Member Name": "member_name",
      Member: "member_name",
      "Start Time": "start_time",
      "Start Date": "start_time",
      Start: "start_time",
      start: "start_time",
      "End Time": "end_time",
      "End Date": "end_time",
      End: "end_time",
      end: "end_time",
      "Reference Number": "external_id",
      Status: "status",
      status: "status",
      _id: "external_id",
      Id: "external_id",
      id: "external_id",
    },
    required: ["resource_name", "start_time", "end_time"],
    availableFields: [
      { value: "resource_name", label: "Resource Name" },
      { value: "member_email", label: "Member Email" },
      { value: "member_name", label: "Member Name" },
      { value: "start_time", label: "Start Time" },
      { value: "end_time", label: "End Time" },
      { value: "status", label: "Status" },
      { value: "external_id", label: "External ID" },
    ],
  },
  leads: {
    displayName: "Leads",
    knownColumns: {
      Email: "email",
      email: "email",
      Name: "full_name",
      name: "full_name",
      "Full Name": "full_name",
      Member: "full_name",
      Company: "company",
      company: "company",
      Phone: "phone",
      phone: "phone",
      Status: "status",
      status: "status",
      Notes: "admin_notes",
      notes: "admin_notes",
      _id: "external_id",
      Id: "external_id",
      id: "external_id",
    },
    required: ["email"],
    availableFields: [
      { value: "email", label: "Email" },
      { value: "full_name", label: "Full Name" },
      { value: "company", label: "Company" },
      { value: "phone", label: "Phone" },
      { value: "status", label: "Status" },
      { value: "admin_notes", label: "Notes" },
      { value: "external_id", label: "External ID" },
    ],
  },
};

/** Teams column mapping (internal — used during member import, not a wizard step) */
export const TEAMS_MAPPING: EntityMapping = {
  displayName: "Teams",
  knownColumns: {
    Name: "name",
    name: "name",
    "Business Name": "business_name",
    VAT: "vat",
    "Reg Number": "reg_number",
    Address: "address",
    City: "city",
    State: "state",
    Zip: "zip",
    Country: "country",
    "Email Address": "email",
    "Billing Address: Address": "billing_address",
    "Billing Address: City": "billing_city",
    "Billing Address: State": "billing_state",
    "Billing Address: Zip": "billing_zip",
    "Billing Address: Country": "billing_country",
  },
  required: ["name"],
  availableFields: [
    { value: "name", label: "Name" },
    { value: "business_name", label: "Business Name" },
    { value: "vat", label: "VAT" },
    { value: "reg_number", label: "Reg Number" },
    { value: "address", label: "Address" },
    { value: "city", label: "City" },
    { value: "state", label: "State" },
    { value: "zip", label: "Postal Code" },
    { value: "country", label: "Country" },
    { value: "email", label: "Email" },
    { value: "billing_address", label: "Billing Address" },
    { value: "billing_city", label: "Billing City" },
    { value: "billing_state", label: "Billing State" },
    { value: "billing_zip", label: "Billing Postal Code" },
    { value: "billing_country", label: "Billing Country" },
  ],
};

/**
 * Auto-detect column mappings from CSV headers.
 * Returns a map of CSV header → platform field.
 * Uses exact match first, then case-insensitive fallback.
 */
export function autoDetectMappings(
  headers: string[],
  entity: MappableEntity,
): Record<string, string> {
  const mapping =
    entity === "teams" ? TEAMS_MAPPING : ENTITY_MAPPINGS[entity];
  const result: Record<string, string> = {};
  const usedFields = new Set<string>();

  for (const header of headers) {
    // Exact match first
    const exactMatch = mapping.knownColumns[header];
    if (exactMatch && !usedFields.has(exactMatch)) {
      result[header] = exactMatch;
      usedFields.add(exactMatch);
      continue;
    }

    // Case-insensitive fallback
    const lowerHeader = header.toLowerCase();
    for (const [known, field] of Object.entries(mapping.knownColumns)) {
      if (known.toLowerCase() === lowerHeader && !usedFields.has(field)) {
        result[header] = field;
        usedFields.add(field);
        break;
      }
    }
  }

  return result;
}

/** Apply column mappings to transform raw CSV rows into mapped rows */
export function applyMappings(
  rows: Record<string, string>[],
  columnMap: Record<string, string>,
): Record<string, string>[] {
  return rows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const [csvHeader, platformField] of Object.entries(columnMap)) {
      if (platformField && row[csvHeader] !== undefined) {
        // Handle first_name + last_name → full_name merge
        if (platformField === "first_name" || platformField === "last_name") {
          const existing = mapped["full_name"] ?? "";
          const val = row[csvHeader]?.trim() ?? "";
          mapped["full_name"] = existing ? `${existing} ${val}`.trim() : val;
        } else {
          mapped[platformField] = row[csvHeader];
        }
      }
    }
    return mapped;
  });
}
