# HireFlow

HireFlow is a lean, production-style Next.js SaaS starter for recruiter workflow automation. It converts raw hiring conversations into structured HR fields, editable summaries, and shareable handoff artifacts.

## What it does

- Captures voice, text, and document-based hiring requirements
- Extracts structured HR fields with confidence scores
- Supports dynamic field selection with predefined, suggested, and custom fields
- Generates recruiter-ready outputs:
  - HR brief
  - Client email draft
  - Short job description
  - WhatsApp summary
- Saves recent sessions locally for reload and editing
- Creates read-only share links for completed sessions
- Redacts highly sensitive PII patterns before AI processing

## Production-focused improvements

- Shared `lib/` modules for extraction, privacy, outputs, logging, and rate limiting
- API routes separated from UI logic
- Retry-aware OpenRouter client wrapper
- Basic in-memory rate limiting per route
- Local persistence for recent sessions plus file-backed share storage
- Cleaner SaaS-style UI with explicit consent and fallback states

## Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required values:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_BASE_URL`

Optional:

- `NEXT_PUBLIC_APP_URL` for absolute share links outside localhost

## Scripts

```bash
npm run dev
npm run typecheck
npm run build
```

## Recommended folder structure

```text
app/
  api/
    extract-pii/
    transliterate/
    sessions/share/
    share/[shareId]/
  capture/
  share/[shareId]/
lib/
  hireflow/
    fields.ts
    output.ts
    privacy.ts
  server/
    env.ts
    extract.ts
    logger.ts
    openrouter.ts
    rate-limit.ts
    share-store.ts
    transliterate.ts
types/
  hireflow.ts
```

## Architecture

See [docs/architecture.md](./docs/architecture.md) for the updated application flow and module boundaries.

## Notes

- Share links use a file-backed adapter in `.data/` for this repo. In a true multi-tenant deployment, swap `lib/server/share-store.ts` with Postgres, Redis, or another durable store.
- Recent editable sessions are stored in browser local storage to keep the product lean.
