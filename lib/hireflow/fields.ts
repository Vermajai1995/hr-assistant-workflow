import type {
  ExtractedFieldRow,
  ExtractionFieldConfig,
  FieldKind,
  HrCategory,
} from "@/types/hireflow";

export const PREDEFINED_FIELDS: ExtractionFieldConfig[] = [
  {
    key: "client-name",
    label: "Client Name",
    category: "client",
    description: "Hiring contact or client person name",
    kind: "predefined",
    enabled: true,
    enabledByDefault: true,
  },
  {
    key: "client-company",
    label: "Client Company / Agency",
    category: "client",
    description: "Company, staffing partner, or agency name",
    kind: "predefined",
    enabled: true,
    enabledByDefault: true,
  },
  {
    key: "client-city",
    label: "Client Location / City",
    category: "location",
    description: "Client or office city",
    kind: "predefined",
    enabled: true,
    enabledByDefault: true,
  },
  {
    key: "position-title",
    label: "Position Title",
    category: "role",
    description: "Role or designation being hired for",
    kind: "predefined",
    enabled: true,
    enabledByDefault: true,
  },
  {
    key: "total-openings",
    label: "Total Openings",
    category: "openings",
    description: "Headcount required",
    kind: "predefined",
    enabled: true,
    enabledByDefault: true,
  },
  {
    key: "experience-years",
    label: "Experience Required (years)",
    category: "role",
    description: "Years of experience expected",
    kind: "predefined",
    enabled: true,
    enabledByDefault: true,
  },
  {
    key: "experience-level",
    label: "Experience Level",
    category: "role",
    description: "Fresher, experienced, or mixed",
    kind: "predefined",
    enabled: true,
    enabledByDefault: true,
  },
  {
    key: "budget-range",
    label: "Budget Range (INR/month)",
    category: "budget",
    description: "Normalized monthly budget or salary range",
    kind: "predefined",
    enabled: true,
    enabledByDefault: true,
  },
  {
    key: "work-mode",
    label: "Work Mode",
    category: "meta",
    description: "Remote, onsite, or hybrid",
    kind: "predefined",
    enabled: true,
    enabledByDefault: true,
  },
  {
    key: "work-location",
    label: "Work Location",
    category: "location",
    description: "Delivery location if different from client city",
    kind: "predefined",
    enabled: false,
    enabledByDefault: false,
  },
  {
    key: "required-skills",
    label: "Required Skills / Tech Stack",
    category: "role",
    description: "Skills, stack, and must-have technologies",
    kind: "predefined",
    enabled: false,
    enabledByDefault: false,
  },
  {
    key: "notice-period",
    label: "Notice Period / Joining Timeline",
    category: "meta",
    description: "Immediate joiners or notice constraints",
    kind: "predefined",
    enabled: false,
    enabledByDefault: false,
  },
  {
    key: "company-type",
    label: "Company Type",
    category: "client",
    description: "Startup, enterprise, GCC, product company, etc.",
    kind: "predefined",
    enabled: false,
    enabledByDefault: false,
  },
  {
    key: "location-preferences",
    label: "Location Preferences",
    category: "location",
    description: "Preferred candidate or office locations",
    kind: "predefined",
    enabled: false,
    enabledByDefault: false,
  },
  {
    key: "contract-type",
    label: "Contract Type",
    category: "meta",
    description: "Full-time, contract, C2H, etc.",
    kind: "predefined",
    enabled: false,
    enabledByDefault: false,
  },
  {
    key: "other-notes",
    label: "Other Notes",
    category: "meta",
    description: "Important extra context",
    kind: "predefined",
    enabled: false,
    enabledByDefault: false,
  },
];

export const FIELD_ORDER = PREDEFINED_FIELDS.map((field) => field.label);

export const CORE_FIELD_LABELS = PREDEFINED_FIELDS.filter(
  (field) => field.enabledByDefault
).map((field) => field.label);

export const AUTO_SUGGESTABLE_FIELDS = [
  "Tech Stack",
  "Notice Period",
  "Work Mode",
  "Company Type",
  "Location Preferences",
  "Visa Sponsorship",
  "Team Size",
  "Interview Process",
];

export function sanitizeFieldKey(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function createCustomField(label: string): ExtractionFieldConfig {
  return {
    key: `custom-${sanitizeFieldKey(label) || "field"}`,
    label: label.trim(),
    category: inferCategoryFromLabel(label),
    description: "User-defined field",
    kind: "custom",
    enabled: true,
  };
}

export function inferCategoryFromLabel(label: string): HrCategory {
  const normalized = label.toLowerCase();
  if (normalized.includes("budget") || normalized.includes("salary")) {
    return "budget";
  }
  if (
    normalized.includes("city") ||
    normalized.includes("location") ||
    normalized.includes("remote") ||
    normalized.includes("hybrid")
  ) {
    return "location";
  }
  if (
    normalized.includes("client") ||
    normalized.includes("company") ||
    normalized.includes("agency")
  ) {
    return "client";
  }
  if (normalized.includes("opening") || normalized.includes("headcount")) {
    return "openings";
  }
  if (
    normalized.includes("skill") ||
    normalized.includes("stack") ||
    normalized.includes("role") ||
    normalized.includes("experience")
  ) {
    return "role";
  }
  return "meta";
}

export function mergeFieldConfigs(
  base: ExtractionFieldConfig[],
  incoming: ExtractionFieldConfig[]
) {
  const byLabel = new Map<string, ExtractionFieldConfig>();

  [...base, ...incoming].forEach((field) => {
    const normalizedLabel = normalizeLabel(field.label);
    if (!normalizedLabel) {
      return;
    }

    const existing = byLabel.get(normalizedLabel);
    byLabel.set(normalizedLabel, {
      ...existing,
      ...field,
      label: field.label.trim(),
      enabled: field.enabled ?? existing?.enabled ?? true,
      kind: resolveKind(existing?.kind, field.kind),
    });
  });

  return [...byLabel.values()];
}

export function getEnabledFields(fields: ExtractionFieldConfig[]) {
  return fields.filter((field) => field.enabled);
}

export function sortRows(rows: ExtractedFieldRow[]) {
  return rows
    .map((row, index) => ({
      ...row,
      id: row.id ?? `${index}-${sanitizeFieldKey(row.field)}-${row.category}`,
    }))
    .sort((a, b) => {
      const aIndex = FIELD_ORDER.indexOf(a.field);
      const bIndex = FIELD_ORDER.indexOf(b.field);
      const aScore = aIndex === -1 ? FIELD_ORDER.length + 1 : aIndex;
      const bScore = bIndex === -1 ? FIELD_ORDER.length + 1 : bIndex;
      if (aScore === bScore) {
        return a.field.localeCompare(b.field);
      }
      return aScore - bScore;
    });
}

export function getFieldValue(rows: ExtractedFieldRow[], fieldLabel: string) {
  return rows.find((row) => row.field === fieldLabel)?.value;
}

export function getCustomRows(rows: ExtractedFieldRow[]) {
  return rows.filter((row) => row.kind === "custom");
}

export function buildSessionTitle(rows: ExtractedFieldRow[]) {
  const role = getFieldValue(rows, "Position Title");
  const client = getFieldValue(rows, "Client Company / Agency");
  const city =
    getFieldValue(rows, "Client Location / City") ||
    getFieldValue(rows, "Work Location");

  return [role || "Untitled Requirement", client, city]
    .filter(Boolean)
    .join(" · ");
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

function resolveKind(previous?: FieldKind, next?: FieldKind): FieldKind {
  if (next === "custom" || previous === "custom") {
    return "custom";
  }
  if (next === "suggested" || previous === "suggested") {
    return "suggested";
  }
  return "predefined";
}
