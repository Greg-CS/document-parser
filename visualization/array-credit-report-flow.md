# Array Credit Report Flow

Visual walkthrough of how the `/credit-report` page pulls a sandbox credit report.

## Full Auto Flow (tries all methods)

```mermaid
flowchart TD
    START([User clicks 'Auto']) --> CREATE[Create sandbox user\nThomas Devos]
    CREATE --> |userId returned| AV{Try Auto-Verify\nPATCH with server token}

    AV -->|userToken returned| ORDER[Order Credit Report]
    AV -->|Failed / 401| OTP{Try TransUnion OTP}

    OTP -->|authMethod = otp| SMS[Select SMS delivery]
    SMS --> PASSCODE[Submit passcode: 12345]
    PASSCODE -->|userToken returned| ORDER
    OTP -->|Failed / got KBA instead| SMFA{Try Equifax SMFA}
    PASSCODE -->|Failed| SMFA

    SMFA -->|authMethod = SMFA| POLL[Poll: did user click link?\nSandbox auto-simulates click]
    POLL -->|202: not yet| WAIT[Wait 2 seconds]
    WAIT --> POLL
    POLL -->|userToken returned| ORDER
    SMFA -->|Failed / got KBA instead| KBA{Try KBA Auto-Answer}
    POLL -->|Timed out| KBA

    KBA --> QUESTIONS[Receive multiple-choice questions]
    QUESTIONS --> MATCH[Match answers against\nknown sandbox cheat sheet]
    MATCH -->|All matched + correct| SUBMIT_KBA[Submit answers]
    SUBMIT_KBA -->|userToken returned| ORDER
    SUBMIT_KBA -->|Wrong answers| RETRY{Retry?\nattempt < 5}
    MATCH -->|Can't match all| RETRY

    RETRY -->|Yes| CREATE
    RETRY -->|No, max attempts| FAIL([All methods failed])

    ORDER --> |reportKey returned| RETRIEVE[Retrieve HTML Report\npolls until ready]
    RETRIEVE --> DONE([Display report in iframe])

    style START fill:#22c55e,color:#fff
    style DONE fill:#22c55e,color:#fff
    style FAIL fill:#ef4444,color:#fff
    style AV fill:#3b82f6,color:#fff
    style OTP fill:#8b5cf6,color:#fff
    style SMFA fill:#f59e0b,color:#000
    style KBA fill:#ec4899,color:#fff
    style ORDER fill:#06b6d4,color:#fff
```

## Verification Methods Compared

```mermaid
flowchart LR
    subgraph AUTO["1. Auto-Verify"]
        direction TB
        A1[Send server token] --> A2[Instant userToken]
    end

    subgraph OTP_FLOW["2. TransUnion OTP"]
        direction TB
        B1[Initiate with TUI] --> B2[Pick SMS or Voice]
        B2 --> B3[Submit passcode\n12345 in sandbox]
        B3 --> B4[userToken]
    end

    subgraph SMFA_FLOW["3. Equifax SMFA"]
        direction TB
        C1[Initiate with EFX] --> C2[Link sent via SMS]
        C2 --> C3[Poll every 2s\nuntil clicked]
        C3 --> C4[userToken]
    end

    subgraph KBA_FLOW["4. KBA Questions"]
        direction TB
        D1[Initiate with\nall providers] --> D2[Receive questions]
        D2 --> D3[Fuzzy-match against\ncheat sheet]
        D3 --> D4[Submit answers]
        D4 --> D5[userToken]
    end

    AUTO -.->|fails| OTP_FLOW
    OTP_FLOW -.->|fails| SMFA_FLOW
    SMFA_FLOW -.->|fails| KBA_FLOW

    style AUTO fill:#3b82f6,color:#fff
    style OTP_FLOW fill:#8b5cf6,color:#fff
    style SMFA_FLOW fill:#f59e0b,color:#000
    style KBA_FLOW fill:#ec4899,color:#fff
```

## API Route Map

```mermaid
flowchart LR
    subgraph BROWSER["Browser (page.tsx)"]
        UI[Credit Report Page]
    end

    subgraph SERVER["Next.js API Routes"]
        R1["/api/array/create-user"]
        R2["/api/array/auto-verify"]
        R3["/api/array/verify-questions"]
        R4["/api/array/verify-answers"]
        R5["/api/array/order-report"]
        R6["/api/array/retrieve-report"]
    end

    subgraph ARRAY["Array Sandbox API"]
        A1["POST /api/user/v2"]
        A2["PATCH /api/authenticate/v2"]
        A3["GET /api/authenticate/v2"]
        A4["POST /api/authenticate/v2"]
        A5["POST /api/report/v2"]
        A6["GET /api/report/v2/html"]
    end

    UI --> R1 --> A1
    UI --> R2 --> A2
    UI --> R3 --> A3
    UI --> R4 --> A4
    UI --> R5 --> A5
    UI --> R6 --> A6

    style BROWSER fill:#f0fdf4,stroke:#22c55e
    style SERVER fill:#eff6ff,stroke:#3b82f6
    style ARRAY fill:#fef3c7,stroke:#f59e0b
```

## KBA Answer Matching Logic

```mermaid
flowchart TD
    Q[Receive a question\nwith answer options] --> EFX{Does any answer have\ncorrectAnswer = true?}
    EFX -->|Yes| PICK_CORRECT[Pick that answer\nEquifax sandbox shortcut]

    EFX -->|No| FILTER[Filter out\n'None of the above']
    FILTER --> EXACT{Exact match?\nlowercase + trim}
    EXACT -->|Yes| PICK[Pick matched answer]

    EXACT -->|No| PARTIAL{Partial match?\none contains the other}
    PARTIAL -->|Yes| PICK

    PARTIAL -->|No| STARTS{Starts-with match?\nhandles truncated text}
    STARTS -->|Yes| PICK

    STARTS -->|No| NONE{Is 'None of the above'\navailable?}
    NONE -->|Yes| PICK_NONE[Pick 'None of the above']
    NONE -->|No| SKIP[Skip question\ncannot answer]

    style PICK fill:#22c55e,color:#fff
    style PICK_CORRECT fill:#22c55e,color:#fff
    style PICK_NONE fill:#f59e0b,color:#000
    style SKIP fill:#ef4444,color:#fff
```
