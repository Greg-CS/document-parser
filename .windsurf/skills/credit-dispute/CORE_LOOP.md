# Core Loop (App)

```mermaid
flowchart TD
  %% Core loop for the credit dispute app

  A[Start / Return Visit] --> B[Set pseudo-user key email
Progress stored locally]

  B --> C[Upload credit reports
TU / EXP / EQ]
  C --> D[Parse + Normalize
MISMO/JSON/HTML/PDF]
  D --> E[Assign bureaus + Validate coverage]

  E --> F[Review report in tabs
Overview / Personal / Accounts / Disputes]

  F --> G[Disputes tab: detect negative items + discrepancies
Severity ranking]
  G --> H[User selects items to dispute]

  H --> I[Open item details modal]
  I --> J[AI analysis + suggested dispute reasons]
  J --> K[User chooses reasons
dedupe / edit]

  K --> L[Send selected reasons/items to Letter Builder]
  L --> M[Letter Builder: fill From info and Recipients]
  M --> N[Generate letter AI-assisted
Fallback template]
  N --> O[Preview + verify]

  O --> P[Snail-mail checklist]
  P --> Q[Print packet letter + checklist
Sign + attach evidence]
  Q --> R[Mail to bureaus / furnishers
keep proof of mailing]

  R --> S[Update dispute round status to Sent
Record mailed date]

  S --> T[Wait for bureau response window
~30-day cycle guidance]
  T --> U[Receive results / updated report]

  U --> V[Re-upload latest reports]
  V --> D

  %% Outcomes
  U --> W[Item deleted / corrected]
  U --> X[Partial change]
  U --> Y[No change]

  W --> Z[Track progress timeline
Close round]
  X --> AA[Decide next action
add evidence / revise reasons]
  Y --> AA

  AA --> G

  %% Notes/constraints
  subgraph Constraints & UX Rules
    C1[Plain-English legal context
FCRA/FDCPA/Metro 2 guidance]
    C2[User never asked to decide without context]
    C3[Separate rounds, narrative timeline]
  end

  F -.-> C1
  G -.-> C2
  S -.-> C3
```

## Notes

- The system is designed around iterative **30-day dispute cycles**: upload → analyze → dispute → generate letter → mail → mark sent → wait → re-upload.
- The loop branches based on outcomes (deleted/corrected, partial, no change), then feeds back into refining disputes or starting the next round.
