# Credit Import Dashboard (Document Parser)

A Next.js + Prisma app for importing credit report exports (primarily `JSON`), exploring bureau data, tracking dispute rounds, and managing credit repair workflows.

See: `visualization/end-user-flow.md` for an end-user flow Mermaid diagram.

## Who this is for

- **Credit repair / disputes workflows**
  People who need to quickly review and compare bureau data (TransUnion / Experian / Equifax), identify high-impact negatives, track dispute rounds, and generate dispute-ready context.
- **Ops / analysts**
  Teams managing credit repair workflows with historical tracking of dispute rounds and outcomes.
- **Developers / integrators**
  Anyone building a credit repair platform with database-backed dispute tracking.

## What the app does

- **Import & persist credit reports**: Drag/drop or browse for `JSON`, `CSV`, `HTML`, `PDF` (PDF UI is present but extraction is not implemented).
- **Unified storage**: All credit reports stored in a single `CreditReport` model with file metadata, parsed data, and universal fields.
- **Dispute round tracking**: Database-backed dispute rounds with status tracking, item selection, and historical record.
- **Bureau split & comparison**: For combined reports, the UI can split and assign bureau-specific views, then compare accounts across bureaus.
- **Public records & inquiries**: View bankruptcies (Chapter 7/13), liens, judgments, and credit inquiries.
- **Letter workflow hooks**: Select extracted values to build a letter preview, with an optional LetterStream submission endpoint.

## Demo / animations

Add short screen recordings here once you capture them (recommended: `docs/` folder).

- `docs/demo-import.gif` — drag/drop import + parsing
- `docs/demo-mapping.gif` — mapping + save mapping
- `docs/demo-credit-modal.gif` — bureau compare + disputes

Example embeds (files not included by default):

```md
![Import demo](docs/demo-import.gif)
![Mapping demo](docs/demo-mapping.gif)
![Credit modal demo](docs/demo-credit-modal.gif)
```

## Prerequisites

- **Node.js**: run with a modern Node version compatible with Next 16 (Node 18+ recommended).
- **Postgres**: Prisma datasource expects `provider = "postgresql"`.
- **DATABASE_URL**: set via environment (used by Prisma).

## Getting Started

1) Install dependencies:

```bash
npm i
```

2) Configure environment variables (at minimum `DATABASE_URL`).

3) Initialize the database schema:

```bash
npx prisma db push
npm run prisma:seed
```

4) Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment variables

- **Required**
  - `DATABASE_URL` - PostgreSQL connection string
- **Optional (only if you use these features)**
  - `GOOGLE_AI_API_KEY` (AI suggestions / letter generation)
  - `LETTERSTREAM_API_ID`, `LETTERSTREAM_API_KEY`, `LETTERSTREAM_BASE_URL` (LetterStream submission)
  - `AWS_REGION`, `S3_BUCKET_NAME`, `S3_PREFIX` (store uploads in S3)

## Production

```bash
npm run build
npm start
```

## Data Model

### CreditReport (Unified Storage)
The app uses a unified `CreditReport` model that combines file storage and credit report data:
- **File metadata**: filename, mimeType, fileSize, uploadedAt
- **Storage**: rawText, rawBytes, S3 references (bucket, objectKey)
- **Credit data**: parsedData (JSON), sourceType, bureauType, reportFingerprint
- **Universal fields**: firstName, lastName, SSN last 4, DOB, account details
- **Relationships**: belongs to User, has many DisputeRounds

### DisputeRound (Tracking)
Database-backed dispute round tracking:
- **Round info**: roundNumber, status (suggested/created/sent/completed)
- **Items**: selectedItemIds, disputeReasons, bureausTargeted
- **Timestamps**: createdAt, updatedAt, completedAt, sentAt
- **Letter**: letterGenerated, letterContent

### User
User records for tracking ownership:
- **Array integration**: arrayUserId, arrayApiKey (optional)
- **Relationships**: has many CreditReports, has many DisputeRounds

## Data Flow

1. **Upload Credit Report**
   - `POST /api/uploaded-documents`
   - Stores file in S3 or database
   - Creates `CreditReport` record with parsed JSON data
   - Computes report fingerprint for similarity detection

2. **View & Analyze**
   - Compare accounts across bureaus
   - Identify negative items and discrepancies
   - View payment history, public records, inquiries

3. **Create Dispute Round**
   - `POST /api/disputes/rounds`
   - Select items to dispute
   - Choose dispute reasons
   - Track status through workflow

4. **Generate Letter**
   - Build letter from selected items
   - Optional LetterStream submission
   - Mark round as sent/completed
 
 ## Integrations / endpoints

 - **LetterStream (optional)**: `POST /api/letterstream/submit`
   - Requires env vars: `LETTERSTREAM_API_ID`, `LETTERSTREAM_API_KEY`, `LETTERSTREAM_BASE_URL`.

## How this project evolved (high level)

- **2025-12-18**: Bootstrapped from Create Next App, initial dashboard foundation.
- **2025-12-22**: Added canonical fields API + LetterStream integration.
- **2025-12-26**: UI upgrades (shadcn/ui components), bureau-aware dashboard modal, and display/label fixes.
- **2026-01-08 → 2026-01-16**: Refactors and UX iteration (accounts/disputes tabs, checkbox flow, component decomposition).
- **2026-01-12**: Introduced dispute criteria, reasons, letter types, and tooltips.
- **2026-01-27**: Added S3 upload path and initial AI endpoints/buttons.
- **2026-01-28**: More modal/tab functionality and fixes to API/model wiring.
- **2026-03-10**: Major refactor - unified storage model (CreditReport), removed unused CanonicalField/FieldMapping tables, implemented database-backed dispute round tracking.
