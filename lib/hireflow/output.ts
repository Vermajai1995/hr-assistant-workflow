import { getFieldValue } from "@/lib/hireflow/fields";
import type { ExtractedFieldRow, GeneratedOutputs } from "@/types/hireflow";

export function generateOutputs(rows: ExtractedFieldRow[]): GeneratedOutputs {
  return {
    brief: buildHrBrief(rows),
    email: buildEmailDraft(rows),
    jd: buildJdText(rows),
    whatsapp: buildWhatsAppText(rows),
  };
}

export function getCompleteness(rows: ExtractedFieldRow[], coreFields: string[]) {
  const present = new Set(rows.map((row) => row.field).filter((field) => coreFields.includes(field)));
  const missing = coreFields.filter((field) => !present.has(field));
  const total = coreFields.length;
  return {
    total,
    present: present.size,
    missing,
    percent: total ? Math.round((present.size / total) * 100) : 0,
  };
}

export function buildHrBrief(rows: ExtractedFieldRow[]) {
  if (!rows.length) {
    return "";
  }

  const position = getFieldValue(rows, "Position Title") || "Open role";
  const clientName = getFieldValue(rows, "Client Name");
  const company = getFieldValue(rows, "Client Company / Agency");
  const city =
    getFieldValue(rows, "Client Location / City") ||
    getFieldValue(rows, "Work Location");
  const openings = getFieldValue(rows, "Total Openings");
  const experience = joinTruthy([
    getFieldValue(rows, "Experience Level"),
    withSuffix(getFieldValue(rows, "Experience Required (years)"), "years"),
  ]);
  const budget = normalizeBudget(getFieldValue(rows, "Budget Range (INR/month)"));
  const skills = getFieldValue(rows, "Required Skills / Tech Stack");
  const mode = getFieldValue(rows, "Work Mode");
  const notice = getFieldValue(rows, "Notice Period / Joining Timeline");

  const lines = [
    `Hiring Requirement - ${position}${city ? ` (${city})` : ""}`,
    "----------------------------------------",
    clientName || company ? `Client: ${joinTruthy([clientName, company], " | ")}` : "",
    openings ? `Openings: ${openings}` : "",
    experience ? `Experience: ${experience}` : "",
    budget ? `Budget: ${budget}` : "",
    mode ? `Work mode: ${mode}` : "",
    notice ? `Joining timeline: ${notice}` : "",
    skills ? `Key skills: ${skills}` : "",
    "",
    "Captured fields:",
    ...rows.map((row) => `- ${row.field}: ${row.value}`),
  ];

  return lines.filter(Boolean).join("\n");
}

export function buildEmailDraft(rows: ExtractedFieldRow[]) {
  if (!rows.length) {
    return "";
  }

  const clientName = getFieldValue(rows, "Client Name") || "team";
  const role = getFieldValue(rows, "Position Title") || "the role";
  const city =
    getFieldValue(rows, "Client Location / City") ||
    getFieldValue(rows, "Work Location");
  const openings = getFieldValue(rows, "Total Openings");
  const experience = joinTruthy([
    getFieldValue(rows, "Experience Level"),
    withSuffix(getFieldValue(rows, "Experience Required (years)"), "years"),
  ]);
  const budget = normalizeBudget(getFieldValue(rows, "Budget Range (INR/month)"));
  const skills = getFieldValue(rows, "Required Skills / Tech Stack");
  const workMode = getFieldValue(rows, "Work Mode");

  const bulletLines = [
    `- Position: ${role}`,
    openings ? `- Openings: ${openings}` : "",
    city ? `- Location: ${city}` : "",
    experience ? `- Experience: ${experience}` : "",
    workMode ? `- Work mode: ${workMode}` : "",
    budget ? `- Budget: ${budget}` : "",
    skills ? `- Skills / stack: ${skills}` : "",
  ].filter(Boolean);

  return [
    `Subject: Requirement summary - ${role}${city ? ` - ${city}` : ""}`,
    "",
    `Hi ${clientName},`,
    "",
    "Thank you for sharing the requirement. Here is the cleaned summary from our discussion:",
    "",
    ...bulletLines,
    "",
    "Please reply with any corrections, especially around openings, experience, budget, or location preferences.",
    "",
    "Regards,",
    "Hiring Team",
  ].join("\n");
}

export function buildJdText(rows: ExtractedFieldRow[]) {
  if (!rows.length) {
    return "";
  }

  const role = getFieldValue(rows, "Position Title") || "Software Engineer";
  const location =
    getFieldValue(rows, "Work Location") ||
    getFieldValue(rows, "Client Location / City");
  const workMode = getFieldValue(rows, "Work Mode");
  const openings = getFieldValue(rows, "Total Openings");
  const experience = withSuffix(getFieldValue(rows, "Experience Required (years)"), "years");
  const budget = normalizeBudget(getFieldValue(rows, "Budget Range (INR/month)"));
  const skills = splitCsv(getFieldValue(rows, "Required Skills / Tech Stack"));
  const notice = getFieldValue(rows, "Notice Period / Joining Timeline");

  const responsibilities = buildResponsibilities(role, skills);
  const requirements = [
    experience ? `- ${experience} of relevant experience` : "",
    workMode ? `- Comfortable with a ${workMode.toLowerCase()} setup` : "",
    location ? `- Able to work from ${location}` : "",
    notice ? `- Joining timeline: ${notice}` : "",
    ...skills.map((skill) => `- Strong working knowledge of ${skill}`),
  ].filter(Boolean);

  return [
    `${role} - Job Description`,
    "----------------------------------------",
    `${openings ? `We are hiring ${openings} ${role}${openings === "1" ? "" : "s"}` : `We are hiring for a ${role} position`}${location ? ` in ${location}` : ""}.`,
    budget ? `Compensation: ${budget}.` : "",
    workMode ? `Work mode: ${workMode}.` : "",
    "",
    "Key responsibilities:",
    ...responsibilities.map((item) => `- ${item}`),
    "",
    "Required skills:",
    ...(requirements.length ? requirements : ["- Strong communication, execution discipline, and stakeholder handling"]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWhatsAppText(rows: ExtractedFieldRow[]) {
  if (!rows.length) {
    return "";
  }

  const role = getFieldValue(rows, "Position Title") || "Open role";
  const client = joinTruthy([
    getFieldValue(rows, "Client Name"),
    getFieldValue(rows, "Client Company / Agency"),
  ]);
  const location =
    getFieldValue(rows, "Client Location / City") ||
    getFieldValue(rows, "Work Location");
  const openings = getFieldValue(rows, "Total Openings");
  const budget = normalizeBudget(getFieldValue(rows, "Budget Range (INR/month)"));
  const skills = getFieldValue(rows, "Required Skills / Tech Stack");

  return [
    `Role: ${role}${location ? ` (${location})` : ""}`,
    client ? `Client: ${client}` : "",
    openings ? `Openings: ${openings}` : "",
    budget ? `Budget: ${budget}` : "",
    skills ? `Skills: ${skills}` : "",
    "",
    "Reply if you want the full JD and submission details.",
  ]
    .filter(Boolean)
    .join(" | ")
    .replace(" |  | ", "\n\n");
}

export function escapeMd(text: string) {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function csvEscape(text: string) {
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function normalizeBudget(value?: string) {
  if (!value) {
    return "";
  }

  const normalized = value
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.includes("INR") ? normalized : `${normalized} INR/month`;
}

function splitCsv(value?: string) {
  if (!value) {
    return [];
  }

  return value
    .split(/,|\/|\||·/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function buildResponsibilities(role: string, skills: string[]) {
  const baseline = [
    `Own end-to-end delivery for the ${role} scope with consistent quality and documentation`,
    "Collaborate with recruiters, hiring managers, and stakeholders to clarify requirement details",
    "Communicate progress, blockers, and delivery timelines clearly",
  ];

  if (!skills.length) {
    return baseline;
  }

  return [
    `Deliver production-quality work across ${skills.slice(0, 3).join(", ")}`,
    "Translate business needs into practical execution plans and dependable outcomes",
    "Work closely with cross-functional stakeholders and maintain clear status visibility",
  ];
}

function withSuffix(value?: string, suffix?: string) {
  return value ? `${value} ${suffix}`.trim() : "";
}

function joinTruthy(values: Array<string | undefined>, separator = " · ") {
  return values.filter(Boolean).join(separator);
}
