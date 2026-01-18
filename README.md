# HR Assistant – Voice to Job Description & Hiring Summary

## Overview
This project is an AI-assisted HR workflow tool that converts unstructured hiring conversations into structured, editable, and exportable hiring artifacts.

Recruiters or hiring managers can:
- Speak requirements
- Paste call transcripts or notes
- Upload documents
- Instantly generate structured HR data, emails, and job descriptions

The goal is to **reduce manual HR effort**, eliminate miscommunication, and standardize requirement capture.

---

## Problem Statement
Hiring requirements are often captured via:
- Phone calls
- WhatsApp messages
- Zoom / Meet conversations
- Informal notes

This leads to:
- Missing or inconsistent information
- Repeated clarification calls
- Manual drafting of emails and JDs
- Loss of context across teams

---

## Solution
The HR Assistant captures raw hiring input and transforms it into structured outputs:

- Extracted HR fields (role, location, budget, experience, etc.)
- Editable requirement table with completeness indicators
- Auto-generated:
  - HR brief (internal notes)
  - Client confirmation email
  - Short Job Description
  - WhatsApp-ready message
- Export formats: CSV, JSON, Markdown

The system highlights missing fields to improve requirement quality before sharing.

---

## Key Features
- Text, paste, file upload, and voice input
- Multi-language support (default: Hindi-EN / Hinglish)
- One-click extraction into structured HR fields
- Editable tables with confidence scores
- Missing-field warnings for incomplete requirements
- Export options: CSV, JSON, Markdown
- Light, Dark, and Smart theme modes
- Embedded feedback widget for continuous improvement

---

## Architecture Overview

➡️ **[View Architecture Diagram](./docs/architecture.md)**

This diagram illustrates how user input (voice/text/files) is processed into
structured HR outputs such as tables, emails, JDs, and exports.

### High-level Flow
The frontend remains stateless.  
All AI processing and enrichment is handled via API routes and an external backend service.

---

## Engineering Decisions
- Used Next.js App Router for co-located UI and API logic
- Kept extraction logic stateless and repeatable
- Prioritized human review by keeping outputs editable
- Highlighted missing fields instead of forcing assumptions
- Separated UI concerns from backend integrations

---

## Limitations
This project is intentionally scoped as a prototype and internal tooling example.

- No authentication or role-based access control
- No persistent storage for captured conversations or extracted data
- No consent management or compliance workflows (e.g. GDPR)
- AI outputs are assistive and require human review before use
- Not designed for high-volume or multi-tenant production usage

These constraints were accepted to prioritize clarity, speed of iteration,
and demonstrating system-level design rather than production hardening.

---

## Future Improvements
- Recruiter authentication with saved requirement history
- Team collaboration and shared requirement reviews
- Configurable extraction templates per role or company
- Integrations with ATS and HR management systems
- Optional self-hosted or private LLM deployments

---

## Data & Privacy Notes
- This is a prototype and technical case study
- No authentication or long-term storage is implemented
- Voice and text inputs are processed transiently
- For production use, explicit consent screens and secure storage would be required

---

## Screenshots

### Step 1 – Capture Hiring Input
![Capture Input](./docs/screenshots/capture-input.png)

### Step 2 – Structured HR Fields
![Structured Fields](./docs/screenshots/structured-fields.png)

### Step 3 – Generated Outputs
![Generated Outputs](./docs/screenshots/generated-outputs.png)

---

## Status
This project is maintained as a **public technical case study** demonstrating
AI-assisted workflow automation for HR and recruitment use cases.
