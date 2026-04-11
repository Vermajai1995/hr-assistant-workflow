```mermaid
flowchart TD
    U["Recruiter / HR user"]
    UI["Next.js App Router UI"]
    Capture["Capture Workspace\nVoice / Text / File / Field Picker"]
    Local["Local Session Cache\nRecent sessions"]
    API["API Routes"]
    Extract["Extraction Service\nprivacy + prompt shaping + retries"]
    AI["OpenRouter LLM"]
    Share["Share Store\nfile adapter"]
    Outputs["HR brief / Email / JD / WhatsApp"]
    SharePage["Read-only share page"]

    U --> UI
    UI --> Capture
    Capture --> Local
    Capture --> API
    API --> Extract
    Extract --> AI
    Extract --> Outputs
    API --> Share
    Share --> SharePage
    Outputs --> UI
```

## Updated architecture

### UI layer

- `app/page.tsx`
  - Lightweight SaaS landing page
- `app/capture/page.tsx`
  - Main recruiter workspace
  - Consent state
  - Dynamic field selection
  - Session restore
  - Share-link creation
- `app/share/[shareId]/page.tsx`
  - Read-only delivery view for shared sessions

### Shared product logic

- `lib/hireflow/fields.ts`
  - Predefined field catalog
  - Custom field creation
  - Session title helpers
  - Row ordering
- `lib/hireflow/privacy.ts`
  - Sensitive-pattern scanning
  - Redaction before AI calls
- `lib/hireflow/output.ts`
  - HR brief
  - Email draft
  - JD enhancement
  - WhatsApp summary

### Server modules

- `lib/server/openrouter.ts`
  - Shared AI client
  - Retry logic
  - JSON parsing helper
- `lib/server/extract.ts`
  - Dynamic extraction prompt generation
  - Suggested-field support
- `lib/server/transliterate.ts`
  - Transliteration wrapper
- `lib/server/rate-limit.ts`
  - Basic in-memory throttling
- `lib/server/logger.ts`
  - Structured console logging
- `lib/server/share-store.ts`
  - File-backed adapter for read-only share sessions

## Recommended next step for full SaaS hardening

1. Replace the file adapter with a real database.
2. Add authentication and tenant-aware session ownership.
3. Move rate limiting to Redis or gateway middleware.
4. Add audit logs and signed share links with expiration.
