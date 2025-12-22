This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

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
