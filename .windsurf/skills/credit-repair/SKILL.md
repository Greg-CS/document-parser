# Credit Repair Document Parser - Application Context

## Overview

This application is a **credit report analysis and dispute management tool** designed for both DIY consumers and credit repair professionals. It parses credit reports from all three major bureaus (TransUnion, Equifax, Experian), identifies negative items, detects discrepancies, and generates legally-compliant dispute letters.

## Core Features

### Multi-Bureau Analysis
- Upload reports from TransUnion, Equifax, and Experian (all at once or one-by-one)
- Cross-bureau comparison to identify inconsistencies
- Automatic detection of negative items, errors, and reporting discrepancies
- Bureau-specific field mapping using MISMO v2.4 standard

### Tradeline Analysis
- Examine credit accounts (credit cards, loans, mortgages, collections)
- Identify impact factors: high utilization, payment history issues, age of accounts
- Flag derogatory indicators: chargeoffs, collections, late payments, public records
- Suggest actionable improvements (balance reduction, authorized user strategies)

### Dispute Management
- AI-powered dispute reason suggestions with severity assessment
- Track dispute rounds per account (suggested → created → sent → completed)
- Prevent duplicate reasons per account
- Generate customizable dispute letters with legal citations

### Letter Generation
- Professional dispute letters formatted for bureau submission
- e-OSCAR compatible formatting
- Include Metro 2 code references and FCRA/FDCPA citations
- Mailing addresses and online submission guidance

### Summary Reports
- Printable PDF overview of issues and priorities
- Client-shareable format for credit repair professionals
- Action item tracking and progress monitoring

## Legal Framework Context

When analyzing reports or generating dispute content, reference these standards:

### Federal Laws
- **FCRA (Fair Credit Reporting Act)** - 15 U.S.C. § 1681
  - § 1681e(b): Accuracy requirements for CRAs
  - § 1681i: Dispute investigation procedures (30-day response)
  - § 1681s-2: Furnisher responsibilities
- **FDCPA (Fair Debt Collection Practices Act)** - 15 U.S.C. § 1692
  - Debt validation rights
  - Prohibited collection practices
- **FCBA (Fair Credit Billing Act)** - Billing error disputes

### Metro 2 Reporting Standards
- Industry standard for credit data formatting
- Key codes to reference in disputes:
  - Account Status codes (11, 13, 61, 64, 65, 71, 78, 80, 82, 83, 84, 93, 94, 95, 96, 97)
  - Payment Rating codes (0-9, L)
  - Special Comment codes (for disputes, fraud, etc.)
  - Compliance Condition codes

### Common Dispute Grounds
1. **Inaccurate Balance/Payment Information** - Wrong amounts reported
2. **Outdated Information** - Items past 7-year reporting window
3. **Mixed Files** - Information from another consumer
4. **Unverifiable Accounts** - Cannot be validated by furnisher
5. **Duplicate Entries** - Same account reported multiple times
6. **Incorrect Account Status** - Wrong status code (e.g., showing open when closed)
7. **Re-aging** - Date of first delinquency incorrectly updated
8. **Paid/Settled Not Reflected** - Payment not properly updated

## Technical Architecture

### Data Flow
```
Credit Report Files (JSON/CSV/HTML/PDF)
    ↓
Parser → Normalized Bureau Data
    ↓
Merger → Unified Report Structure
    ↓
Analyzer → Dispute Items + Differentials
    ↓
AI Reasoning → Suggested Disputes + Explanations
    ↓
Letter Generator → Formatted Dispute Letters
```

### Key Data Structures
- `ImportedFile` - Raw uploaded file with parsed JSON
- `BureauAssignment` - Which file maps to which bureau
- `DisputeItem` - Individual disputable entry with severity
- `DisputeProgress` - Round tracking per item
- `AccountGroup` - Matched accounts across bureaus

### Bureau Identification
Files are identified by patterns:
- TransUnion: `TA01`, `TUI`, `TU` prefixes, `transunion` in paths
- Experian: `RA01`, `XPN`, `EXP` prefixes, `experian` in paths
- Equifax: `EA01`, `EFX`, `EQ` prefixes, `equifax` in paths

## UI/UX Guidelines

### Severity Color Coding
- **High (Red)**: Collections, chargeoffs, 90+ days late, public records
- **Medium (Amber)**: 60 days late, derogatory marks, high utilization
- **Low (Blue)**: 30 days late, minor discrepancies, inquiries

### User Communication
- Use plain language explanations ("layman's terms") for all issues
- Avoid legal jargon unless in formal letter context
- Explain WHY something hurts credit, not just THAT it does
- Provide actionable next steps

### Dispute Workflow
1. User reviews identified issues in overview
2. Clicks item to see AI analysis in modal
3. AI auto-suggests reasons (user doesn't manually pick)
4. User selects which reasons to include in letter
5. System prevents duplicate reasons per account
6. Letter generated with selected items

## Development Principles

### When Adding Features
- Always consider multi-bureau implications
- Maintain consistency with existing severity/category systems
- Use existing UI patterns (popovers for context, modals for detail)
- Follow atomic component structure

### When Handling Credit Data
- Never expose full SSN, account numbers (mask appropriately)
- Treat all credit data as sensitive
- Normalize field names for display (remove MISMO prefixes like `@_`)
- Handle missing bureau data gracefully

### AI Integration
- Suggestions are assistive, not authoritative
- Always allow user override of AI decisions
- Provide confidence scores for transparency
- Track and prevent duplicate reason submissions

## File Structure Reference

```
components/
├── atoms/          → Primitives (Button, Badge, Input)
├── molecules/      → Compositions (FileCard, DisputeAccountModal)
│   ├── modal/      → Modal components
│   └── Tabs/       → Tab content (DisputesTab, AccountTab, OverviewTab)
└── organisms/      → Full sections (ImporterSection, InlineCreditReportView)

lib/
├── dispute-fields.ts   → Dispute extraction logic, severity rules
├── utils.ts            → General utilities
├── interfaces/         → TypeScript interfaces
└── types/              → Type definitions
```

## Common Tasks

### Adding a New Dispute Category
1. Update `DisputeCategory` type in `dispute-fields.ts`
2. Add to `CATEGORY_LABELS` mapping
3. Add extraction logic in `extractDisputeItems()`
4. Add layman explanation in `generateLaymanExplanation()`

### Adding New Bureau Field Mapping
1. Check MISMO v2.4 spec for field path
2. Add to `FIELD_DEFINITIONS` if needs description
3. Update `normalizeFieldName()` if special formatting needed
4. Add to relevant extraction functions

### Enhancing AI Suggestions
1. Update API call in `suggestReason()` with new parameters
2. Handle new response fields in state
3. Update modal/UI to display new information
