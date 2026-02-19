# AI Prompts & API Guide

> How each AI-powered route works, what it sends to the model, and what comes back.

All four routes use **Google Gemini 2.0 Flash** as the AI model. They all need the `GOOGLE_AI_API_KEY` environment variable set.

---

## Overview

| Route | Purpose | Input | Output |
|-------|---------|-------|--------|
| `/api/generate-letter` | Write a full dispute letter | Dispute items + consumer/recipient info + optional credit report files | Complete formatted letter |
| `/api/disputes/suggest-reason` | Pick the best dispute reason | One dispute item + list of reason options | One selected reason + short summary |
| `/api/disputes/suggest-criteria` | Pick the best dispute category | List of dispute items | One selected criteria + why |
| `/api/disputes/generate-summary` | Summarize all dispute findings | All dispute items + severity counts | 2-3 sentence encouraging summary |

---

## Full Prompts Used

This section shows the **exact prompts** sent to Gemini for each route, with explanations of what each part does.

### 1. Generate Letter Prompt

```
You are an expert credit dispute letter writer. Generate a professional, legally-compliant dispute letter based on the following information:

**Letter Type:** {templateType.toUpperCase()} Dispute Letter
**Date:** {currentDate}
**Consumer Name:** {consumerName || "[Consumer Name]"}
**Consumer Address:** {consumerAddress || "[Consumer Address]"}
**Recipient:** {recipientName || "[Recipient Name]"}
{accountInfo ? `**Account Reference:** ${accountInfo}` : ""}

**Disputed Items:**
{itemsList}

{templateInstructions}

{files && files.length > 0 ? `**IMPORTANT:** I have attached the original credit report file(s) for your reference. Please analyze the document(s) carefully to:
1. Extract additional relevant details about the disputed items
2. Identify specific account numbers, dates, and amounts from the report
3. Reference specific sections or pages where inaccuracies appear
4. Use exact wording from the report when describing discrepancies

` : ""}
**Important Guidelines:**
1. Be professional and assertive but not aggressive
2. Reference relevant laws (FCRA, FDCPA as applicable)
3. Request specific actions and a response within 30 days
4. Include a clear statement that this is a formal dispute
5. Do not include any placeholder text - use the provided information
6. Format the letter properly with date, addresses, salutation, body, and closing
{files && files.length > 0 ? "7. Reference specific details from the attached credit report document(s)" : ""}

Generate the complete dispute letter:
```

**What each part does:**

- **Role assignment** (`You are an expert...`) — Sets the AI's persona and expertise level
- **`{templateType}`** — Dynamically set to "cra", "creditor", "collection", or "generic"
- **`{currentDate}`** — Auto-generated current date in long format (e.g., "February 19, 2026")
- **`{consumerName}`, `{consumerAddress}`, `{recipientName}`** — Pulled from request body, fallback to placeholder if missing
- **`{accountInfo}`** — Optional account reference, only included if provided
- **`{itemsList}`** — Pre-formatted bullet list: `- Field: Value (Reason: why it's wrong)`
- **`{templateInstructions}`** — Legal requirements specific to the template type (CRA/creditor/collection)
- **File attachment section** — Conditionally included only if `files.length > 0`
- **Important guidelines** — Constraints on tone, legal references, formatting, and avoiding placeholders

**Why it works:** The prompt gives Gemini a clear role, structured data, legal context, and explicit formatting rules. The file attachment feature lets it pull exact account numbers and dates from the actual credit report instead of guessing.

---

### 2. Suggest Reason Prompt

```
You help choose the best dispute reason from a fixed list.

Dispute context (may be incomplete):
- creditorName: {dispute.creditorName ?? ""}
- accountIdentifier: {dispute.accountIdentifier ?? ""}
- bureau: {dispute.bureau ?? ""}
- category: {dispute.category ?? ""}
- fieldPath: {dispute.fieldPath ?? ""}
- value: {typeof dispute.value === "string" ? dispute.value : JSON.stringify(dispute.value ?? "")}
- reason label (existing): {dispute.reason ?? ""}
- severity: {dispute.severity ?? ""}

Available reason options:
{optionsText}

Rules:
- Pick exactly ONE option from the list.
- Output valid JSON only.
- Use non-assertive language in the summary (e.g. "may", "appears", "could").

Return JSON with this shape:
{"id":"<option id>","label":"<option label>","group":"cra|creditor|collection","summary":"<1-2 sentences>"}
```

**What each part does:**

- **Role** (`You help choose...`) — Narrow, specific task definition
- **`{dispute.*}`** — All available fields from the dispute object (creditorName, accountIdentifier, bureau, category, fieldPath, value, reason, severity). Uses `??` nullish coalescing to show empty string if missing.
- **`{optionsText}`** — Pre-formatted list of all available reason options: `- (group) Label [id=value]`
- **Rules** — Hard constraints: pick ONE, output JSON only, use cautious language
- **JSON shape** — Exact structure expected in the response

**Why it works:** By listing all valid options and demanding JSON output, we force the AI to pick from our predefined list instead of inventing new reasons. The "non-assertive language" rule keeps the summary legally safe ("may be incorrect" vs "is incorrect").

---

### 3. Suggest Criteria Prompt

```
You help pick the best dispute criteria for a credit dispute letter.

Dispute items to include:
{itemsText}

Available criteria options:
{optionsText}

Pick the single best criteria that covers these items. Output JSON only:
{"value":"<option value>","label":"<option label>","summary":"<1 sentence why>"}
```

**What each part does:**

- **Role** — Defines the task (pick best criteria)
- **`{itemsText}`** — Pre-formatted list from request body: `- Label: Value`
- **`{optionsText}`** — Hardcoded list of 8 criteria options formatted as: `- Label (value=value)`
- **Instruction** — Pick ONE that covers all items, JSON only
- **JSON shape** — Expected output format

**Why it works:** Simpler than suggest-reason because the options are hardcoded in the route. The AI just needs to look at the items and pick the category that best fits (e.g., if items mention "Collections", pick `collection`).

---

### 4. Generate Summary Prompt

```
You are a credit repair expert helping a consumer understand their credit report issues. 
    
Based on the following dispute items found in their credit report, provide a brief, encouraging summary (2-3 sentences max) that:
1. Acknowledges the issues found
2. Provides actionable guidance on priority
3. Uses simple, encouraging language

Dispute Items Summary:
- High Severity: {counts.high} items (collections, charge-offs, 90+ days late)
- Medium Severity: {counts.medium} items (60 days late, derogatory marks)  
- Low Severity: {counts.low} items (30 days late, minor errors)

Sample items:
{items.slice(0, 10).map(i => `- ${i.creditorName || 'Unknown'}: ${i.reason} (${i.severity})`).join('\n')}

Respond with ONLY the summary text, no formatting or labels. Keep it under 100 words and make it actionable.
```

**What each part does:**

- **Role** (`credit repair expert helping a consumer`) — Sets empathetic, educational tone
- **Task definition** — 2-3 sentences, encouraging, actionable
- **`{counts.high}`, `{counts.medium}`, `{counts.low}`** — Severity counts from request body
- **`{items.slice(0, 10).map(...)}`** — Up to 10 sample items formatted as: `- CreditorName: Reason (severity)`
- **Output constraints** — Plain text only, under 100 words, actionable

**Why it works:** The prompt gives context (severity breakdown) and examples (actual items) so the AI can write a personalized summary. The "encouraging language" instruction keeps it positive instead of doom-and-gloom. The word limit prevents rambling.

---

## 1. Generate Letter (`/api/generate-letter`)

**What it does:** Takes dispute items and consumer info and writes a complete, professional dispute letter ready to send to a credit bureau, creditor, or collection agency.

### How the prompt works

The prompt tells Gemini: *"You are an expert credit dispute letter writer."* Then it feeds in:

- **Letter type** — one of four templates: `cra`, `creditor`, `collection`, or `generic`
- **Consumer info** — name, address (the person disputing)
- **Recipient** — who the letter is addressed to
- **Disputed items** — each item formatted as `- Field: Value (Reason: why it's wrong)`
- **Template-specific legal instructions** — different laws apply depending on who you're writing to:
  - **CRA letters** reference FCRA Section 611 (your right to dispute with credit bureaus)
  - **Creditor letters** reference FCRA accuracy requirements
  - **Collection letters** reference FDCPA Section 1692g (debt validation rights)
  - **Generic** keeps it simple

### File attachments (optional)

You can attach the actual credit report file (PDF, HTML, JSON) as base64-encoded data. When files are attached, the prompt adds extra instructions telling Gemini to:
- Pull specific account numbers, dates, and amounts from the report
- Reference exact sections where errors appear
- Use the report's own wording when describing problems

### What comes back

```json
{
  "success": true,
  "letter": "Dear Consumer Dispute Department...",
  "metadata": {
    "templateType": "cra",
    "itemCount": 3,
    "filesAttached": 1,
    "generatedAt": "2026-02-19T..."
  }
}
```

### Request shape

```typescript
POST /api/generate-letter
{
  templateType: "cra" | "creditor" | "collection" | "generic",
  consumerName: "John Doe",
  consumerAddress: "123 Main St, City, ST 12345",
  recipientName: "Experian Consumer Dispute Department",
  items: [
    { label: "Account Status", value: "Collections", reason: "Account was paid in full" }
  ],
  accountInfo?: "Account #12345",       // optional
  files?: [{ data: "base64...", mimeType: "application/pdf" }]  // optional
}
```

---

## 2. Suggest Reason (`/api/disputes/suggest-reason`)

**What it does:** Given a single dispute item and a list of possible reasons, the AI picks the one that fits best.

### How the prompt works

The prompt tells Gemini: *"You help choose the best dispute reason from a fixed list."*

It receives the dispute context:
- Creditor name, account ID, bureau, category, field path, current value, severity
- The full list of available reason options, each tagged with a group (`cra`, `creditor`, or `collection`)

Key rules in the prompt:
- **Pick exactly ONE** option from the list (no making up new ones)
- **Output valid JSON only** (no extra text)
- **Use non-assertive language** in the summary ("may", "appears", "could" — not "this IS wrong")

### JSON parsing safety

The model sometimes wraps JSON in markdown code fences. The route handles this by:
1. Trying `JSON.parse()` directly
2. If that fails, extracting the first `{...}` block with regex and parsing that
3. Validating the selected ID actually exists in the original options list

### What comes back

```json
{
  "selected": { "id": "not_mine", "label": "Account Not Mine", "group": "cra" },
  "summary": "This account may not belong to the consumer based on the unfamiliar creditor name."
}
```

### Request shape

```typescript
POST /api/disputes/suggest-reason
{
  dispute: {
    id: "abc123",
    creditorName: "Unknown Collections LLC",
    bureau: "Experian",
    category: "CREDIT_LIABILITY",
    fieldPath: "@_AccountStatusType",
    value: "Collections",
    severity: "high"
  },
  options: [
    { id: "not_mine", label: "Account Not Mine", group: "cra" },
    { id: "paid_in_full", label: "Paid in Full", group: "creditor" },
    // ... all available reasons
  ]
}
```

---

## 3. Suggest Criteria (`/api/disputes/suggest-criteria`)

**What it does:** Given a list of dispute items, picks the best overall dispute category from a hardcoded list.

### The hardcoded criteria options

These are built into the route (not sent by the client):

| Value | Label |
|-------|-------|
| `hard_inquiry` | Hard Inquiry |
| `late_payment` | Late Payment |
| `collection` | Collection Account |
| `charge_off` | Charge-Off |
| `incorrect_balance` | Incorrect Balance |
| `not_mine` | Account Not Mine |
| `identity_theft` | Identity Theft |
| `outdated` | Outdated Information |

### How the prompt works

The prompt tells Gemini: *"You help pick the best dispute criteria for a credit dispute letter."*

It lists the dispute items and the available criteria, then asks: *"Pick the single best criteria that covers these items."*

Same JSON-safety parsing as suggest-reason (try direct parse, fallback to regex extraction, validate against known options).

### What comes back

```json
{
  "selected": { "value": "collection", "label": "Collection Account" },
  "summary": "The disputed items relate to a collection account that may be inaccurately reported."
}
```

### Request shape

```typescript
POST /api/disputes/suggest-criteria
{
  items: [
    { label: "Account Status", value: "Collections" },
    { label: "Balance", value: "$2,450" }
  ],
  context?: "Optional extra context string"
}
```

---

## 4. Generate Summary (`/api/disputes/generate-summary`)

**What it does:** Takes all the dispute items found in a credit report and writes a short, encouraging summary for the user.

### How the prompt works

The prompt tells Gemini: *"You are a credit repair expert helping a consumer understand their credit report issues."*

It receives:
- **Severity counts** — how many high/medium/low items were found
- **Sample items** — up to 10 items with creditor name, reason, and severity

The prompt asks for a 2-3 sentence summary that:
1. Acknowledges the issues found
2. Gives actionable guidance on what to prioritize
3. Uses simple, encouraging language
4. Stays under 100 words

### What comes back

```json
{
  "summary": "Your report shows 3 high-priority items including collections that should be addressed first. Focus on disputing the charge-off with ABC Bank and the unknown collection account, as resolving these could significantly improve your score. The minor late payment issues can be addressed afterward."
}
```

### Request shape

```typescript
POST /api/disputes/generate-summary
{
  items: [
    {
      category: "CREDIT_LIABILITY",
      severity: "high",
      creditorName: "ABC Bank",
      fieldName: "AccountStatus",
      reason: "Charge-off reported but account was settled"
    }
  ],
  counts: { high: 3, medium: 2, low: 1 }
}
```

---

## Common Patterns Across All Routes

### Authentication
None of these routes have user auth — they're internal API routes called by the frontend. The only "auth" is the `GOOGLE_AI_API_KEY` env var for Gemini access.

### Error handling
Every route follows the same pattern:
1. Check if `GOOGLE_AI_API_KEY` exists → 500 if missing
2. Validate the request body → 400 if bad
3. Call Gemini → 500 if it fails
4. Parse the response → 500 if unparseable

### Model used
All routes use **`gemini-2.0-flash`** — Google's fast, cheap model. Good enough for structured text generation, and responds in ~1-2 seconds.

### SDK difference
Three routes use the newer `@google/genai` SDK:
```typescript
const ai = new GoogleGenAI({ apiKey: "..." });
ai.models.generateContent({ model: "gemini-2.0-flash", contents: [...] });
```

The `generate-summary` route uses the older `@google/generative-ai` SDK:
```typescript
const genAI = new GoogleGenerativeAI("...");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
model.generateContent(prompt);
```

Both work the same way — they just have slightly different syntax. The newer SDK is cleaner.

### Prompt engineering tricks used
- **Role assignment** — "You are an expert..." tells the model what persona to adopt
- **Structured input** — data is formatted with labels and bullet points so the model can parse it
- **Constrained output** — "Output JSON only" / "Pick exactly ONE" prevents rambling
- **Non-assertive language** — "may", "appears" keeps legal language safe
- **Fallback parsing** — regex extraction handles when the model wraps JSON in markdown fences
