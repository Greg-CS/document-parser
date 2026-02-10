# How the Array Credit Report Page Works

> Written so a 15-year-old can follow along. No jargon without an explanation.

---

## The Big Picture

This page talks to **Array**, a company that sits between us and the three big credit bureaus (Experian, Equifax, TransUnion). We ask Array to pull a credit report for a fake test person named **Thomas Devos**. But before Array hands over the report, it needs to make sure we're allowed to see it — that's the **identity verification** step.

Think of it like this:

1. **Create an account** for Thomas Devos on Array's servers.
2. **Prove we're really Thomas** by passing an identity check.
3. **Order the credit report** now that we're verified.
4. **Download and display** the report as HTML.

---

## Step 1: Create a User

We send Thomas Devos's personal info (name, SSN, date of birth, address) to Array's sandbox API. Array creates a "User object" and gives us back a **userId** — a unique ID like `2e0b380f-2d63-4969-ac66-82e8f12aba49`.

- **What's a sandbox?** It's a fake/test version of the real system. No real credit data is involved. The sandbox lives at `https://sandbox.array.io`.
- **What's an appKey?** It's like a password that tells Array which app is making the request. Ours is a public sandbox key that anyone can use for testing.

**Code:** `app/api/array/create-user/route.ts` sends a `POST` to `/api/user/v2`.

---

## Step 2: Verify Identity

This is the hardest part. Array needs proof that we control this user before it gives us sensitive data. There are **four different ways** to prove identity, and our page tries them in order like a waterfall — if one fails, it moves to the next.

### Method 1: Auto-Verify (the dream)

We send a special **server token** (like a master key) directly to Array and say "trust me, this user is legit." If Array accepts it, we instantly get a **userToken** and skip everything else.

- **Why might it fail?** Array only allows this for clients who have a direct relationship with the credit bureaus. The sandbox might not accept the example token from the docs.

**Code:** `app/api/array/auto-verify/route.ts` sends a `PATCH` to `/api/authenticate/v2`.

### Method 2: TransUnion OTP (One-Time Passcode)

OTP = "One-Time Passcode." Like when a website texts you a 6-digit code to log in.

1. We tell Array: "Use TransUnion to verify this user."
2. Array says: "OK, do they want the code by text or voice call?"
3. We pick "text message."
4. In the real world, TransUnion would text a code to Thomas's phone. In the **sandbox**, the code is always **12345**.
5. We submit `12345` and get our **userToken**.

**Code:** The `tryOtp()` function in `page.tsx` handles this 3-step dance.

### Method 3: Equifax SMFA (Secure Multi-Factor Authentication)

SMFA = Equifax sends a link via text message. The user just has to **click the link** — no codes, no questions.

1. We tell Array: "Use Equifax to verify."
2. Array texts a link to the user's phone.
3. We keep asking Array "did they click yet?" every 2 seconds (this is called **polling**).
4. In the sandbox, the click is simulated automatically.
5. Once "clicked," we get our **userToken**.

**Code:** The `trySmfa()` function handles the polling loop.

### Method 4: KBA (Knowledge-Based Authentication)

KBA = "Knowledge-Based Authentication." This is the classic "Which of these streets have you lived on?" quiz.

1. Array sends us multiple-choice questions that only the real person should know the answers to.
2. We have a **cheat sheet** of correct answers for the sandbox (the `SANDBOX_KBA_ANSWERS` list at the top of the file).
3. Our code compares each answer option against the cheat sheet using fuzzy matching (lowercase, trim spaces, check if one contains the other).
4. If we answer enough questions correctly, we get a **userToken**.
5. If we get them wrong, we can try again with a new user.

**Code:** The `pickAnswer()` and `autoAnswer()` functions handle the matching. `tryKba()` runs the full loop.

---

## Step 3: Order the Report

Now that we have a **userToken** (proof of identity), we can order a credit report. We tell Array:

- Which user (`userId`)
- Our proof of identity (`userToken`, sent as a header)
- What kind of report we want (`exp1bReportScore` = Experian report with credit score)

Array gives us back a **reportKey** (like a receipt number) and a **displayToken** (permission to view the report).

**Code:** `app/api/array/order-report/route.ts`

---

## Step 4: Retrieve the Report

We use the reportKey and displayToken to download the actual HTML credit report. Sometimes Array needs a few seconds to generate it, so our server **polls** (keeps asking "is it ready yet?") until the report comes back.

Once we have the HTML, we display it in an `<iframe>` on the page.

**Code:** `app/api/array/retrieve-report/route.ts`

---

## The Two Buttons

### "Auto (tries all methods)"

This is the smart button. It:

1. Creates a new Thomas Devos user
2. Tries auto-verify → if that fails...
3. Tries TransUnion OTP → if that fails...
4. Tries Equifax SMFA → if that fails...
5. Tries KBA auto-answer → if that fails...
6. Creates a **brand new user** and starts over (up to 5 times)

You just click it and watch the debug log at the bottom to see what's happening.

### "Manual (KBA questions)"

This shows you the actual KBA questions so you can pick answers yourself. It pre-selects the best guesses from the cheat sheet, but you can change them before submitting.

---

## Key Terms Glossary

| Term | What It Means |
|------|--------------|
| **Sandbox** | A fake test environment. No real data. |
| **appKey** | Identifies our app to Array. Like a username. |
| **userId** | Identifies the user (Thomas Devos) on Array's servers. |
| **userToken** | Short-lived proof that the user's identity was verified. Expires in ~15 min. |
| **authToken** | Temporary token used during the verification process itself. |
| **KBA** | Knowledge-Based Authentication — security questions. |
| **OTP** | One-Time Passcode — a code texted to your phone. |
| **SMFA** | Secure Multi-Factor Auth — click a link texted to your phone. |
| **Polling** | Repeatedly asking "is it done yet?" every few seconds. |
| **reportKey** | Receipt number for an ordered credit report. |
| **displayToken** | Permission slip to view a specific report. |

---

## File Map

```
app/
  credit-report/
    page.tsx              ← The UI + all verification logic
    HOW-IT-WORKS.md       ← You are here

  api/array/
    create-user/route.ts      ← POST: creates Thomas Devos on Array
    auto-verify/route.ts      ← POST: tries instant verification with server token
    verify-questions/route.ts ← GET: asks Array for verification questions
    verify-answers/route.ts   ← POST: submits answers (KBA, OTP, or SMFA)
    order-report/route.ts     ← POST: orders the credit report
    retrieve-report/route.ts  ← GET: downloads the HTML report
```

---

## Why Did It Take So Long?

The tricky part was **KBA answer matching**. Array's sandbox questions have slightly different formatting than the answer cheat sheet (extra spaces, different capitalization, truncated text). We had to build fuzzy matching that handles all those variations. Plus, sometimes the sandbox just gives questions where none of the known answers apply, so we had to build the retry loop that creates a fresh user and tries again.

Adding the OTP and SMFA methods from the docs gave us reliable fallback paths that don't depend on flaky answer matching.
