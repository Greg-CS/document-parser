# Credit Import Dashboard (Document Parser)

A Next.js + Prisma app for importing credit report exports (primarily `JSON`), exploring bureau data, and mapping vendor/bureau-specific fields to a canonical schema you can store and ingest consistently.

## Who this is for

- **Credit repair / disputes workflows**
  People who need to quickly review and compare bureau data (TransUnion / Experian / Equifax), identify high-impact negatives, and generate dispute-ready context.
- **Ops / analysts**
  Teams normalizing multiple “source types” into one canonical format for reporting, downstream automation, or spreadsheets.
- **Developers / integrators**
  Anyone building an ingestion pipeline (DB + webhook + downstream processing) where mapping rules are managed in a UI.

## What the app does

- **Import & persist files**: Drag/drop or browse for `JSON`, `CSV`, `HTML`, `PDF` (PDF UI is present but extraction is not implemented).
- **Preview parsed content**: View raw JSON, derive simple label previews, and extract nested key paths.
- **Mapping UI**: Map extracted source fields (supports dot paths, e.g. `CREDIT_RESPONSE.CREDIT_LIABILITY[*].@_AccountIdentifier`) to canonical field names.
- **Ingest into a normalized report**: Uses saved mappings to canonicalize `UploadedDocument.parsedData` into a `Report` row (limited to a safe list of “universal fields”).
- **Bureau split & comparison**: For combined reports, the UI can split and assign bureau-specific views, then compare accounts across bureaus.
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

- **Node.js**: run with a modern Node version compatible with Next 16.
- **Postgres**: Prisma datasource expects `provider = "postgresql"`.
- **DATABASE_URL**: set via environment (used by Prisma).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## What to do with the JSON

- **Upload it** via the Import card (drag/drop or browse). The app stores uploads in Postgres as `UploadedDocument` (including raw bytes/text when available).
- **Parse it** (for JSON and HTML) to enable key extraction and downstream UI.
- **Map it**: create a reusable mapping from your source field paths to the canonical field list.
- **Ingest it**: the app applies saved mappings and creates a normalized `Report` row.

Notes:

- **Array roots**: if the JSON file’s root is an array, the UI uses the first element for some flows.
- **Key paths**: ingestion uses dot paths and supports `[*]` wildcards (first matching item wins). For arrays without a wildcard, it falls back to the first item.

## Quick flow (JSON → Mapping → DB)

1. Drop/select a .json file → appears in queue
         ↓
2. Click "Parse" → JSON is parsed, keys extracted
         ↓
3. A new "Mapping" tab appears in the preview mode buttons
         ↓
4. Click "Mapping" tab → see the mapping UI:
   ┌─────────────────────────────────────────────────┐
   │  Source Type: [EXPERIAN ▼]                      │
   │                                                 │
   │  Source Field      → Maps To (Canonical)        │
   │  ─────────────────────────────────────────────  │
   │  acct_num          [accountNumber ▼]            │
   │  status            [accountStatus ▼]            │
   │  balance           [balance ▼]                  │
   │  opened            [openedDate ▼]               │
   │                                                 │
   │  [Save Mapping]   ✓ Saved 4 mapping(s)          │
   └─────────────────────────────────────────────────┘
         ↓
5. Click "Save Mapping" → POSTs to /api/field-mappings
         ↓
6. Mappings saved to FieldMapping table in your DB
 
 ## Data flow (high level)
 
 - **Upload**: `POST /api/uploaded-documents`
   - Stores `UploadedDocument.rawBytes`, `UploadedDocument.rawText` (for text-like files), and `UploadedDocument.parsedData`.
   - Creates an initial `Report` row containing `rawPayload` for audit/debug.
 - **Mappings**: `POST /api/field-mappings`
   - Upserts mapping rows by `(sourceType, sourceField, targetField)`.
 - **Ingest**: `POST /api/reports/ingest`
   - Loads mappings for the document’s `sourceType` and canonicalizes into a normalized `Report`.
 
 ## Integrations / endpoints
 
 - **n8n webhook proxy**: `POST /api/n8n-webhook`
   - Called client-side after upload with event payloads (e.g. `event: "file_submitted"`).
   - The upstream URL is currently hardcoded in `app/api/n8n-webhook/route.ts`.
 - **LetterStream (optional)**: `POST /api/letterstream/submit`
   - Requires env vars: `LETTERSTREAM_API_ID`, `LETTERSTREAM_API_KEY`, `LETTERSTREAM_BASE_URL`.
