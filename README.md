# 🎙️ HireFlow

**AI-powered hiring workflow automation that turns conversations into recruitment artifacts**

Convert unstructured hiring calls, notes, and documents into structured HR requirements, job descriptions, and recruiter-ready outputs—with full field customization and privacy safeguards.

---

## 🚀 Overview

HireFlow is a lean, production-focused Next.js SaaS starter that automates the hiring intake process. Instead of manually transcribing client calls and creating job briefs, recruiters and HR teams can now:

- **Capture** raw hiring conversations (voice, text, PDFs, DOCX files)
- **Extract** structured data into HR-standard fields with AI confidence scores
- **Review** and customize extracted fields in real-time
- **Generate** polished recruiter artifacts (HR brief, email drafts, job descriptions, WhatsApp summaries)
- **Share** read-only sessions via secure links

**Who it's for:** Recruiting agencies, staffing firms, in-house HR teams, talent acquisition professionals

---

## 🎯 Problem Statement

Recruiting today involves a painful manual workflow:

1. **Calls with clients** → No structured notes captured
2. **Manual transcription** → Time lost translating call audio to requirements doc
3. **Recreating fields** → Copy-pasting into CRMs, job boards, email templates
4. **Duplicated effort** → Same information entered across platforms (Naukri, LinkedIn, Spreadsheets, etc.)
5. **Inconsistent output** → JDs lack standardization, brief templates ignored

**Real-world impact:**  
A recruiter handles 5–10 hiring briefs daily. Each call-to-output cycle takes 20–30 minutes of manual work. HireFlow compresses that to 2–3 minutes of structured review.

---

## 💡 Solution

HireFlow automates the entire intake-to-output pipeline:

```
┌─────────────────┐      ┌──────────────┐      ┌────────────┐      ┌──────────────┐
│  Capture Input  │ ───> │ Extract Data │ ───> │   Review   │ ───> │  Generate    │
│ Voice/Text/File │      │  via OpenAI  │      │   & Edit   │      │  Artifacts   │
└─────────────────┘      └──────────────┘      └────────────┘      └──────────────┘
                                ▼
                        ┌──────────────┐
                        │  PII Redacted│
                        │  Before Send │
                        └──────────────┘
```

**Features:**
- **One-click capture:** Record voice, paste chat logs, upload PDFs/DOCX
- **Smart extraction:** LLM-powered field detection with confidence scores
- **Custom fields:** Define role-specific attributes beyond defaults
- **Suggested fields:** AI recommends missing context automatically
- **Multi-format output:** HR brief + Email + JD + WhatsApp (all auto-generated)
- **Session persistence:** Edit, refine, and share completed intakes
- **Privacy-first:** Redacts Aadhaar, PAN, bank accounts, phone, emails before AI processing

---

## ⚙️ Features

| Feature | Details |
|---------|---------|
| 🎙️ **Voice Input** | Browser-based speech recognition (English & Hinglish) |
| 📝 **Text Input** | Paste raw transcripts, chat logs, or call notes |
| 📄 **File Upload** | Support for PDF, DOCX (automatic extraction) |
| 🧠 **AI Extraction** | OpenAI-powered field detection with scoring |
| 📊 **Structured Fields** | 15+ predefined HR fields + unlimited custom fields |
| ✅ **Field Review** | Edit, confirm, or redact extracted data |
| 💬 **Smart Suggestions** | AI detects missing context and suggests fields |
| 📋 **HR Brief** | Formatted hiring requirement summary |
| ✉️ **Email Draft** | Client communication template |
| 📑 **Job Description** | Short-form JD for job boards |
| 📱 **WhatsApp Format** | Portable summary for team chat |
| 🔐 **PII Redaction** | Removes sensitive IDs before LLM processing |
| ⚡ **Confidence Scoring** | Shows extraction confidence per field |
| 🔄 **Session Management** | Save, load, and edit past intakes |
| 🔗 **Share Links** | Read-only shared sessions with expiration support |
| 🎨 **Custom Fields** | Add unlimited role-specific attributes |
| 🌐 **Multi-language** | English, Hindi, Hinglish support |

---

## 🧩 How It Works

### User Flow (3 Steps)

#### **Step 1: Capture**
- Open the workspace
- Choose input method:
  - 🎙️ **Record** live audio (browser speech recognition)
  - 📝 **Paste** text from transcription tools, WhatsApp, Slack
  - 📤 **Upload** PDF, DOCX files (auto-extracted)
- Optional: Select which HR fields to extract (default: 8 core fields enabled)
- Agree to privacy consent before processing

#### **Step 2: Review**
- View all extracted fields in a table
- See AI confidence scores
- Edit any field value in-place
- Add custom fields on-the-fly
- Accept AI-suggested fields
- Review privacy warnings (PII detected & redacted)

#### **Step 3: Generate**
- Switch between 4 output tabs:
  - **Fields**: Sortable, exportable table of all extracted data
  - **Brief**: Formatted HR requirement summary
  - **Email**: Ready-to-send client update
  - **JD**: Job description for posting
  - **WhatsApp**: Portable text summary for team
- Copy, download, or share each output
- Create shareable read-only session link

### Behind the Scenes

```typescript
// 1. Capture phase
Transcript (Voice/Text/File) 
  → Audio extraction (Web Speech API / Mammoth.js)
  → Privacy scan (detect PII patterns)

// 2. Privacy phase
Raw text → Redact sensitive patterns (Aadhaar, PAN, etc.) 
  → Send sanitized version to LLM

// 3. Extraction phase
Sanitized text → LLM prompt with selected fields
  → Parse JSON response
  → Return structured rows + confidence scores
  → Suggest additional fields

// 4. Output phase
Rows → Generate 4 formatted artifacts
  → Return for UI display & download
```

---

## 🖥 Screens & UI Flow

### **1. Home Page** (`/`)
- Marketing landing page
- Product value proposition (3-step workflow shown)
- CTA: "Open Workspace"
- Link to portfolio

### **2. Capture Workspace** (`/capture`)
**The main interface—three phases:**

**Phase 1: Capture**
- Input selection buttons (Record / Paste / Upload)
- Transcript editor (textarea)
- Sample transcript (auto-filled for demo)
- Field selector (toggle predefined fields)
- Consent checkbox (required before extraction)
- "Extract to Review" button

**Phase 2: Review**
- Extracted fields table:
  - Field name | Value | Category | Confidence | Actions
  - Editable cells (click to modify)
  - Delete row option
- "Add Custom Field" button
- AI-suggested fields (optional cards below)
- "Accept Suggestion" buttons per field
- Privacy warnings section (if PII detected)
- "Generate Outputs" button

**Phase 3: Generate**
- Tab navigation: Fields | Brief | Email | JD | WhatsApp
- Each tab shows formatted output
- Copy-to-clipboard button per output
- Download as .txt button
- Share link creation button
- Recent sessions sidebar (8 most recent sessions)

### **3. Share Page** (`/share/[shareId]`)
- Read-only view of completed session
- Same 4 output tabs
- No editing allowed
- Copy buttons only
- Session metadata (created date, completeness %)

---

## 🛠 Tech Stack

### **Frontend**
- **Framework:** Next.js 16+ (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + PostCSS
- **State Management:** React Hooks (useState, useEffect)
- **Storage:** Browser localStorage (session cache)

### **Backend APIs**
- **Runtime:** Node.js (Next.js server actions)
- **API Routes:** `/api/extract-pii`, `/api/transliterate`, `/api/sessions/share`
- **Data Format:** JSON

### **AI & LLM**
- **Provider:** OpenRouter (multi-model gateway)
- **Model (default):** OpenAI GPT-4 Mini (`openai/gpt-4-mini`)
- **Alternatives:** Claude 3, Mistral, Local LLMs via OpenRouter
- **Integration:** REST API with retry logic & rate limiting

### **File Processing**
- **Speech Recognition:** Web Speech API (browser native)
- **PDF Extraction:** pdfjs-dist
- **DOCX Extraction:** Mammoth.js
- **Canvas Rendering:** @napi-rs/canvas (if needed for PDF thumbnails)

### **DevOps & Deployment**
- **Package Manager:** npm
- **TypeScript:** Full type safety (tsconfig.json configured)
- **Code Quality:** Babel React Compiler (JSX optimization)
- **Build:** Next.js static export + server actions

### **Security & Privacy**
- **PII Detection:** Custom regex patterns (Aadhaar, PAN, UPI, etc.)
- **Redaction:** Before LLM processing
- **Rate Limiting:** In-memory throttling per IP per route
- **Environment Variables:** Secure key management (.env.local)

---

## 📦 Installation

### Prerequisites
- **Node.js** 18+ (check with `node --version`)
- **npm** 9+ (included with Node.js)
- **API Key:** OpenRouter account with API key (free tier available)

### Steps

**1. Clone the repository**
```bash
git clone <repository-url>
cd pii-assistant
```

**2. Install dependencies**
```bash
npm install
```

**3. Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys:
```env
# Required
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_MODEL=openai/gpt-4-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Get your OpenRouter API key:**
1. Visit [openrouter.ai](https://openrouter.ai)
2. Sign up / Log in
3. Go to Settings → API Keys
4. Create a new key
5. Paste into `.env.local`

**4. Start the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**5. (Optional) Type checking**
```bash
npm run typecheck
```

**6. (Optional) Build for production**
```bash
npm run build
npm run start
```

---

## 🌍 Deployment

### Quick Start: Vercel

HireFlow deploys instantly to Vercel:

**1. Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

**2. Deploy on Vercel**
- Visit [vercel.com](https://vercel.com)
- Click "New Project"
- Import your GitHub repository
- Set environment variables:
  - `OPENROUTER_API_KEY` (required)
  - `OPENROUTER_MODEL` (optional, defaults to `openai/gpt-4-mini`)
  - `OPENROUTER_BASE_URL` (optional, defaults to official OpenRouter endpoint)
  - `NEXT_PUBLIC_APP_URL` (set to your deployed URL for proper share links)
- Click "Deploy"

**3. Share links will work automatically** (NEXT_PUBLIC_APP_URL set correctly)

### Alternative Deployments

**Docker:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

**AWS / Azure / Self-hosted:**
- Build the app: `npm run build`
- Deploy the `.next/` folder to your server
- Set environment variables in your host platform
- Run `npm start` or use PM2 for process management

---

## ⚠️ Security & Privacy Warnings

### Scope

This is an **experimental prototype** designed for demonstration and learning. It is **not production-hardened** for handling real candidate or client data at scale.

### Data Handling

- **Input:** Text/audio you provide is sent to:
  - OpenRouter (after PII redaction)
  - Locally stored in browser session cache
  - Optionally saved to `.data/` (file-backed store for shares)

- **Privacy Redaction:** Before AI processing, the app redacts:
  - Aadhaar numbers (12-digit patterns)
  - PAN identifiers (10-char pan format)
  - Bank accounts (9–18 digit numbers)
  - UPI IDs (email-like UPI addresses)
  - Passport numbers
  - Phone numbers (+91 or 6–9 prefix)
  - Email addresses

- **Consent:** Users must check the consent box before extraction. This implies understanding that data is sent to OpenRouter.

### Limitations

- ❌ **No authentication:** Anyone can access `/capture`
- ❌ **No encryption:** Data in `.data/` (shares) is stored in plaintext
- ❌ **No audit logs:** No tracking of who accessed what
- ❌ **No data retention policy:** Share data persists indefinitely
- ❌ **No tenant isolation:** Multi-user setups require additional controls

### Recommendations for Production Use

1. **Add authentication** (OAuth2, SSO, or basic auth)
2. **Replace file storage** with Postgres, MongoDB, or managed DB
3. **Enable encryption** (TLS for transit, AES for storage)
4. **Implement rate limiting** via Redis or API gateway (not just in-memory)
5. **Add audit logging** (who extracted, when, what fields)
6. **Set data retention** policy (auto-purge old sessions after 30 days)
7. **Use HTTPS only** (enforce in production)
8. **Add CORS restrictions** (limit API access to your domain)
9. **Sign share links** with expiration tokens (prevent enumeration)
10. **GDPR compliance:** Add data export & deletion endpoints

See [SECURITY.md](./SECURITY.md) for detailed threat analysis.

---

## 📁 Project Structure

```
pii-assistant/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── capture/page.tsx            # Main workspace (1500+ lines)
│   ├── share/[shareId]/page.tsx    # Read-only share view
│   └── api/
│       ├── extract-pii/route.ts    # AI extraction endpoint
│       ├── transliterate/route.ts  # Text transliteration (optional)
│       └── sessions/
│           ├── [sessionId]/route.ts
│           └── share/route.ts      # Share link creation
├── lib/
│   ├── hireflow/
│   │   ├── fields.ts               # Field definitions & operations
│   │   ├── output.ts               # Output generation (brief/email/jd/whatsapp)
│   │   └── privacy.ts              # PII detection & redaction
│   └── server/
│       ├── env.ts                  # Environment variable helpers
│       ├── extract.ts              # Extraction orchestration
│       ├── openrouter.ts           # LLM client wrapper
│       ├── logger.ts               # Structured logging
│       ├── rate-limit.ts           # In-memory throttling
│       ├── share-store.ts          # File-backed session storage
│       └── transliterate.ts        # Hindi → English conversion
├── types/
│   └── hireflow.ts                 # TypeScript interfaces
├── components/
│   └── site-header.tsx             # Header with links
├── public/                         # Static assets
├── styles/
│   └── globals.css                 # Tailwind + custom CSS
├── .env.example                    # Environment template
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript config
├── next.config.ts                  # Next.js config
└── README.md                       # This file
```

---

## 🔑 Key Modules Explained

### **`lib/hireflow/fields.ts`**
- Defines 15+ predefined HR fields (role, budget, location, experience, etc.)
- Field categories (client, role, budget, location, meta)
- Operations: create custom fields, merge configs, sort rows, build session titles

### **`lib/hireflow/output.ts`**
- Generates 4 output formats from extracted rows:
  - HR brief (structured summary for intake notes)
  - Email draft (client communication template)
  - Job description (short-form JD for posting)
  - WhatsApp (portable text for team chat)
- Utility functions: CSV escape, Markdown escape, completeness scoring

### **`lib/hireflow/privacy.ts`**
- Regex patterns for 7 PII types (Aadhaar, PAN, UPI, Phone, Email, Bank, Passport)
- Scans raw text and logs warnings to UI
- Redacts patterns before LLM processing

### **`lib/server/extract.ts`**
- Builds dynamic LLM prompt from selected fields
- Sends sanitized text to OpenRouter
- Parses JSON response into structured rows
- Suggests missing fields based on AI analysis

### **`lib/server/openrouter.ts`**
- REST client for OpenRouter API
- Automatic retry logic (3 attempts with exponential backoff)
- Rate limit handling (429 responses)
- JSON parsing helpers

### **`lib/server/rate-limit.ts`**
- Simple in-memory token bucket per IP + route
- Default: 25 requests per hour per IP
- Throws error if limit exceeded

### **`lib/server/share-store.ts`**
- File-backed storage for read-only share sessions
- Stores in `.data/[shareId].json`
- Methods: save, retrieve, list (useful for debugging)

---

## 🎯 Common Workflows

### **Workflow 1: Simple Call-to-Brief**
1. Open `/capture`
2. Paste call transcript into textarea (or record live voice)
3. Keep default fields enabled
4. Click "Extract to Review"
5. Review extracted fields in table
6. Click "Generate Outputs"
7. Copy HR Brief tab → Paste into email / CRM

### **Workflow 2: Custom Role with Suggested Fields**
1. Open `/capture`
2. Upload DOCX (client brief document)
3. Un-check unwanted fields
4. Click "+ Add Custom Field" → Add "Contract Duration"
5. Click "Extract to Review"
6. AI suggests fields → Accept relevant ones
7. Click "Generate Outputs"
8. Use Email + JD tabs → Send to hiring team

### **Workflow 3: Share Session with Stakeholders**
1. Complete extraction in `/capture`
2. Click "Create Share Link"
3. Copy generated URL → Share with team/client
4. Recipients access read-only `/share/[shareId]` page
5. They can view and copy all outputs (no editing)
6. Optional: Set expiration on link (future feature)

### **Workflow 4: Edit & Refine**
1. Open `/capture`
2. Paste transcript → Extract
3. Click on any field value to edit
4. Add custom fields if needed
5. Accept AI-suggested fields
6. Delete irrelevant fields (trash icon)
7. Click "Generate Outputs" again
8. Regenerated outputs reflect all changes

---

## 🤔 FAQ

**Q: Is this production-ready?**  
A: It's a well-architected prototype. For production, add authentication, real DB, and HTTPS. See [Recommendations](#recommendations-for-production-use).

**Q: Can I use a local LLM?**  
A: Yes! OpenRouter supports local models via MCP. Update `OPENROUTER_MODEL` in `.env.local`.

**Q: How much does OpenRouter cost?**  
A: Pricing varies by model. GPT-4 Mini ≈ $0.15 per 1M input tokens. Test with free credits first.

**Q: Does it support languages other than English?**  
A: The LLM is English-optimized. Hinglish (Hindi + English mix) works but may have lower accuracy. Transliteration route available in `/api/transliterate`.

**Q: What happens to my data after session close?**  
A: Browser localStorage clears when cache is deleted. Shared sessions (via `/share/[shareId]`) persist in `.data/` until you delete them manually.

**Q: Can I export extracted data?**  
A: Yes! Download Fields tab as CSV from UI (future feature), or copy-paste from table.

**Q: Does it work offline?**  
A: No. Extraction requires OpenRouter API. Voice recording works offline, but sending to AI needs internet.

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │ capture/page.tsx (React Component)              │   │
│  │ - Voice capture (Web Speech API)                │   │
│  │ - File upload (PDF/DOCX parsing)                │   │
│  │ - Text input (textarea)                         │   │
│  │ - Field selection & review table                │   │
│  │ - Output tabs (brief/email/jd/whatsapp)         │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓ HTTP POST                     │
└─────────────────────────────────────────────────────────┘
                                                           
┌─────────────────────────────────────────────────────────┐
│                 Next.js Server (Backend)                │
│  ┌──────────────────────────────────────────────────┐   │
│  │ /api/extract-pii (Route Handler)                │   │
│  │ 1. Validate consent + rate limit                │   │
│  │ 2. Scan for PII patterns                        │   │
│  │ 3. Redact sensitive data                        │   │
│  │ 4. Call extractHrFields()                       │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │ lib/server/extract.ts                           │   │
│  │ - Build LLM prompt from selected fields         │   │
│  │ - Send to OpenRouter API                        │   │
│  │ - Parse JSON response                           │   │
│  │ - Generate 4 output formats                     │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓ REST API                      │
└─────────────────────────────────────────────────────────┘
                                                           
┌─────────────────────────────────────────────────────────┐
│              OpenRouter API (External)                  │
│  - Multi-model LLM gateway                             │
│  - Supports GPT-4, Claude, Mistral, etc.              │
│  - Returns structured JSON with extracted fields      │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Next Steps & Roadmap

### Immediate (POC Phase)
- ✅ Voice capture + text input
- ✅ LLM-powered extraction
- ✅ Field review & editing
- ✅ Output generation (4 formats)
- ✅ Session persistence
- ✅ Share links

### Short-term (MVP Phase)
- 🔄 Database persistence (replace `.data/` folder)
- 🔄 Authentication (email OTP or social login)
- 🔄 Signed share links with expiration
- 🔄 Data export (CSV, JSON)
- 🔄 Edit history & undo/redo
- 🔄 Team collaboration (real-time sync)

### Medium-term (SaaS Phase)
- 🔄 Webhooks (send extracted data to external systems)
- 🔄 API for programmatic access
- 🔄 Audit logs & compliance reporting
- 🔄 Custom branding & white-labeling
- 🔄 Advanced analytics (extraction accuracy metrics)
- 🔄 Batch processing (upload multiple files)

### Long-term (Enterprise Phase)
- 🔄 SSO / SAML support
- 🔄 VPC deployment options
- 🔄 Custom LLM fine-tuning
- 🔄 Multi-language support (BERT for non-English)
- 🔄 Mobile apps (iOS, Android)

---

## 🤝 Contributing

Contributions are welcome! Areas for help:

1. **Bug fixes:** Report via GitHub Issues
2. **Feature requests:** Suggest new extraction fields or output formats
3. **Translations:** Add support for more languages
4. **Documentation:** Improve guides or add code examples
5. **Performance:** Optimize extraction speed or reduce API calls
6. **Security:** Audit PII patterns or add new redaction rules

**To contribute:**
```bash
1. Fork the repository
2. Create a feature branch: git checkout -b feature/your-feature
3. Commit changes: git commit -m "Add your feature"
4. Push: git push origin feature/your-feature
5. Open a Pull Request
```

---

## 📬 Contact & Author

**Jai Patel**  
- **Portfolio:** [pateljai.com](https://pateljai.com)
- **GitHub:** [@vermajai1995](https://github.com/vermajai1995)
- **Email:** jai@pateljai.com

---

## 📄 License

This project is provided as a public case study and prototype. See [LICENSE](./LICENSE) for details.

---

## ⚖️ Legal Disclaimer

HireFlow is provided **as-is** for educational and demonstration purposes. The authors assume no liability for data loss, unauthorized access, or misuse. Users are responsible for:

- ✅ Understanding data privacy obligations in their jurisdiction
- ✅ Obtaining consent from all parties whose data may be processed
- ✅ Complying with GDPR, CCPA, and local regulations
- ✅ Adding security controls before production deployment

Use at your own risk.

---

## 🔗 Useful Links

- [OpenRouter Docs](https://openrouter.ai/docs) – LLM API reference
- [Next.js Docs](https://nextjs.org/docs) – Framework guide
- [Tailwind CSS](https://tailwindcss.com/docs) – Styling library
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) – Voice recognition
- [SECURITY.md](./SECURITY.md) – Detailed security analysis

---

**Built with ❤️ for recruiters and HR teams.**
