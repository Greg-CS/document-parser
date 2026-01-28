# Credit Report Dispute Workflow

## User Journey Overview

```mermaid
flowchart TD
    subgraph AUTH["🔐 Authentication"]
        A1[User Signs Up] --> A2[Email Verification]
        A2 --> A3[Profile Setup]
        A3 --> A4[Dashboard Access]
    end

    subgraph UPLOAD["📤 Report Upload"]
        B1[Upload Credit Reports] --> B2{Single or Multiple?}
        B2 -->|Single| B3[Assign Bureau]
        B2 -->|Multiple| B4[Auto-Detect Bureaus]
        B3 --> B5[Parse & Validate]
        B4 --> B5
        B5 --> B6[Merge Multi-Bureau Data]
    end

    subgraph REVIEW["📊 Report Review"]
        C1[View Overview Tab] --> C2[Personal Info Check]
        C2 --> C3[View Accounts Tab]
        C3 --> C4[Compare Bureau Data]
        C4 --> C5[Identify Discrepancies]
    end

    subgraph DISPUTES["⚠️ Dispute Process"]
        D1[Navigate to Disputes Tab] --> D2[View Summary Section]
        D2 --> D3[Items Sorted by Severity]
        D3 --> D4[Select Dispute Item]
        D4 --> D5[View Account Context Modal]
        D5 --> D6[Request AI Analysis]
        D6 --> D7[Review Suggested Reasons]
        D7 --> D8[Select Reasons for Letter]
        D8 --> D9{More Items?}
        D9 -->|Yes| D4
        D9 -->|No| D10[Proceed to Rounds]
    end

    subgraph ROUNDS["📅 Dispute Rounds"]
        E1[Create Dispute Round] --> E2[Set Round Date]
        E2 --> E3[Generate Dispute Letter]
        E3 --> E4[Download/Print Letter]
        E4 --> E5[Mail to Bureaus]
        E5 --> E6[Track Round Status]
        E6 --> E7{Response Received?}
        E7 -->|Yes - Resolved| E8[Mark Complete]
        E7 -->|Yes - Denied| E9[Start Next Round]
        E7 -->|No - 30 Days| E10[Follow Up]
        E9 --> E1
        E10 --> E6
    end

    AUTH --> UPLOAD
    UPLOAD --> REVIEW
    REVIEW --> DISPUTES
    DISPUTES --> ROUNDS
```

## Detailed Phase Breakdown

### Phase 1: Authentication (Future)
```mermaid
sequenceDiagram
    participant U as User
    participant App as Application
    participant Auth as Auth Service
    participant DB as Database

    U->>App: Navigate to Sign Up
    App->>U: Show Registration Form
    U->>App: Submit Credentials
    App->>Auth: Create Account
    Auth->>U: Send Verification Email
    U->>Auth: Click Verification Link
    Auth->>DB: Activate Account
    DB->>App: Account Ready
    App->>U: Redirect to Dashboard
```

### Phase 2: Report Upload Flow
```mermaid
flowchart LR
    subgraph INPUT["File Input"]
        F1[JSON File]
        F2[CSV File]
        F3[HTML File]
        F4[PDF File]
    end

    subgraph PARSE["Parsing"]
        P1[Detect Format]
        P2[Extract MISMO Data]
        P3[Normalize Fields]
    end

    subgraph ASSIGN["Bureau Assignment"]
        A1[TransUnion - TA01/TUI]
        A2[Experian - RA01/XPN]
        A3[Equifax - EA01/EFX]
    end

    F1 --> P1
    F2 --> P1
    F3 --> P1
    F4 --> P1
    P1 --> P2
    P2 --> P3
    P3 --> A1
    P3 --> A2
    P3 --> A3
```

### Phase 3: Disputes Tab Workflow
```mermaid
flowchart TD
    subgraph SUMMARY["📋 Summary Section"]
        S1[All Items Overview]
        S2[High Severity Items]
        S3[Medium Severity Items]
        S4[Low Severity Items]
        S1 --> S2
        S2 --> S3
        S3 --> S4
    end

    subgraph SELECT["🎯 Item Selection"]
        I1[Click Dispute Item]
        I2[View Account Context]
        I3[See Issue Details]
        I1 --> I2
        I2 --> I3
    end

    subgraph AI["🤖 AI Analysis"]
        AI1[Request AI Suggestion]
        AI2[Receive Reasons + Confidence]
        AI3[View Layman Explanation]
        AI4[Select Reasons]
        AI1 --> AI2
        AI2 --> AI3
        AI3 --> AI4
    end

    subgraph LETTER["✉️ Letter Building"]
        L1[Add to Letter Queue]
        L2[Review Selected Items]
        L3[Finalize Letter]
        L1 --> L2
        L2 --> L3
    end

    subgraph ROUND["📅 Dispute Round"]
        R1[Set Round Number]
        R2[Select Date]
        R3[Track Status]
        R4[Mark Complete/Next Round]
        R1 --> R2
        R2 --> R3
        R3 --> R4
    end

    SUMMARY --> SELECT
    SELECT --> AI
    AI --> LETTER
    LETTER --> ROUND
```

### Phase 4: Dispute Round Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Suggested: Items Selected
    Suggested --> Created: Generate Letter
    Created --> Sent: Mail to Bureau
    Sent --> Waiting: 30-Day Period
    Waiting --> Completed: Resolved/Removed
    Waiting --> Denied: Bureau Rejects
    Denied --> NextRound: Upload New Report
    NextRound --> Suggested: Start Round 2+
    Completed --> [*]
```

## Severity-Based Dispute Priority

```mermaid
flowchart TD
    subgraph HIGH["🔴 HIGH PRIORITY - Address First"]
        H1[Collections]
        H2[Charge-offs]
        H3[90+ Days Late]
        H4[Public Records]
        H5[Bankruptcies]
    end

    subgraph MEDIUM["🟡 MEDIUM PRIORITY - Address Second"]
        M1[60 Days Late]
        M2[Derogatory Marks]
        M3[High Utilization Reports]
        M4[Account Status Errors]
    end

    subgraph LOW["🔵 LOW PRIORITY - Address Last"]
        L1[30 Days Late]
        L2[Hard Inquiries]
        L3[Minor Discrepancies]
        L4[Personal Info Errors]
    end

    HIGH --> MEDIUM
    MEDIUM --> LOW
```

## Letter Generation Flow

```mermaid
flowchart LR
    subgraph COLLECT["Collect Data"]
        C1[Selected Items]
        C2[AI Reasons]
        C3[Account Details]
        C4[Bureau Info]
    end

    subgraph BUILD["Build Letter"]
        B1[Header + Date]
        B2[Consumer Info]
        B3[Dispute Items List]
        B4[Legal Citations]
        B5[Signature Block]
    end

    subgraph OUTPUT["Output"]
        O1[Preview Letter]
        O2[Download PDF]
        O3[Print Ready]
    end

    C1 --> B1
    C2 --> B3
    C3 --> B3
    C4 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 --> B5
    B5 --> O1
    O1 --> O2
    O1 --> O3
```
