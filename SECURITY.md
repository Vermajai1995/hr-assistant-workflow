# Security Policy

## Overview
This project is an experimental HR automation tool designed to convert unstructured
input (voice, text, or files) into structured hiring artifacts such as tables,
emails, and job descriptions.

It is provided as a **public case study** and **prototype**, not as a production-ready
HR system.

---

## Data & Privacy Considerations

- The application **does not intentionally persist personal data**.
- User input is processed in a **session-scoped** manner.
- Extracted HR fields are generated in memory and rendered client-side.
- No interview or hiring data is stored permanently by default.

⚠️ **Important:**  
Users may voluntarily paste or speak information that could contain
personally identifiable information (PII). This project assumes **user consent**
for provided input and does not attempt to validate ownership of that data.

---

## Third-Party Services

This project integrates with external services for processing:

- **AI Processing:** OpenRouter (LLM inference)
- **Backend APIs:** External backend service (deployed separately)
- **Optional Storage / Logging:** Managed via backend integrations (e.g. Google Sheets, Supabase)

Sensitive credentials (API keys, service secrets) are:
- Managed via environment variables
- Excluded from version control
- Never exposed to the client

---

## Security Scope & Limitations

- No authentication or authorization layer is implemented
- No access control or tenant isolation
- No encrypted data storage layer
- No audit logs or compliance guarantees

As such, this project **should not be used in production environments**
handling real candidate or client data without additional safeguards.

---

## Reporting a Vulnerability

If you discover:
- Accidental exposure of sensitive data
- A security flaw in request handling
- Misuse of third-party services
- Any behavior that could lead to unsafe data handling

Please report it responsibly using one of the following methods:

- Open a GitHub issue with details (preferred)
- Submit a report via the feedback form:
  https://feedback-jai-patel.vercel.app

Please avoid sharing sensitive details publicly.
Responsible disclosure is appreciated.

---

## Disclaimer

This repository is maintained for educational and demonstrative purposes.
The maintainer assumes no responsibility for misuse of the software
or for data provided by end users during experimentation.
