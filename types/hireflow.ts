export type HrCategory =
  | "client"
  | "role"
  | "openings"
  | "budget"
  | "location"
  | "meta";

export type FieldKind = "predefined" | "custom" | "suggested";

export type ExtractionFieldConfig = {
  key: string;
  label: string;
  category: HrCategory;
  description: string;
  kind: FieldKind;
  enabled: boolean;
  enabledByDefault?: boolean;
};

export type ExtractedFieldRow = {
  id?: string;
  key?: string;
  field: string;
  value: string;
  category: HrCategory | string;
  confidence: number;
  snippet?: string;
  kind?: FieldKind;
};

export type PrivacyWarning = {
  type: "aadhaar" | "pan" | "bank" | "upi" | "passport" | "phone" | "email";
  label: string;
  severity: "warning" | "blocked";
  match: string;
  message: string;
};

export type GeneratedOutputs = {
  brief: string;
  email: string;
  jd: string;
  whatsapp: string;
};

export type ExtractResponse = {
  rows: ExtractedFieldRow[];
  suggestedFields: ExtractionFieldConfig[];
  warnings: PrivacyWarning[];
  outputs: GeneratedOutputs;
  sanitizedText: string;
  extractionSummary: string;
};

export type SessionSnapshot = {
  id: string;
  title: string;
  transcript: string;
  rows: ExtractedFieldRow[];
  selectedFields: ExtractionFieldConfig[];
  suggestedFields: ExtractionFieldConfig[];
  outputs: GeneratedOutputs;
  warnings: PrivacyWarning[];
  createdAt: string;
  updatedAt: string;
  consentAccepted: boolean;
  shareId?: string;
  shareUrl?: string;
};

export type SharedSessionRecord = {
  shareId: string;
  createdAt: string;
  snapshot: SessionSnapshot;
};
