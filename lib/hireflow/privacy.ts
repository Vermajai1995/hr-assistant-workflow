import type { PrivacyWarning } from "@/types/hireflow";

const SENSITIVE_PATTERNS: Array<{
  type: PrivacyWarning["type"];
  label: string;
  regex: RegExp;
  message: string;
}> = [
  {
    type: "aadhaar",
    label: "Aadhaar",
    regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    message: "Aadhaar-like numbers are redacted before AI processing.",
  },
  {
    type: "pan",
    label: "PAN",
    regex: /\b[A-Z]{5}\d{4}[A-Z]\b/gi,
    message: "PAN-like identifiers are redacted before AI processing.",
  },
  {
    type: "bank",
    label: "Bank Account",
    regex: /\b\d{9,18}\b/g,
    message: "Long account-like numbers are redacted before AI processing.",
  },
  {
    type: "upi",
    label: "UPI ID",
    regex: /\b[\w.-]{2,}@[a-z]{2,}\b/gi,
    message: "UPI IDs are redacted before AI processing.",
  },
  {
    type: "passport",
    label: "Passport",
    regex: /\b[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]\b/g,
    message: "Passport-like identifiers are redacted before AI processing.",
  },
  {
    type: "phone",
    label: "Phone",
    regex: /\b(?:\+91[-\s]?)?[6-9]\d{9}\b/g,
    message: "Phone numbers are redacted before AI processing.",
  },
  {
    type: "email",
    label: "Email",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    message: "Email addresses are redacted before AI processing.",
  },
];

export function scanSensitiveContent(text: string) {
  const warnings: PrivacyWarning[] = [];

  for (const pattern of SENSITIVE_PATTERNS) {
    const matches = text.match(pattern.regex) ?? [];
    matches.slice(0, 3).forEach((match) => {
      warnings.push({
        type: pattern.type,
        label: pattern.label,
        severity: pattern.type === "aadhaar" || pattern.type === "pan" ? "blocked" : "warning",
        match,
        message: pattern.message,
      });
    });
  }

  return warnings;
}

export function redactSensitiveContent(text: string) {
  return SENSITIVE_PATTERNS.reduce((safeText, pattern) => {
    return safeText.replace(pattern.regex, `[REDACTED_${pattern.label.toUpperCase().replace(/\s+/g, "_")}]`);
  }, text);
}

export function getPrivacyDisclaimer() {
  return "HireFlow redacts highly sensitive IDs before sending text to the AI model. Avoid uploading Aadhaar, PAN, bank, or passport details.";
}
