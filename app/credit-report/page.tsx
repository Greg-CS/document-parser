"use client";

import { useRef, useState } from "react";

type Step =
  | "idle"
  | "working"
  | "answering"
  | "ordering-report"
  | "loading-report"
  | "done"
  | "error";

interface KbaQuestion {
  id: string;
  text: string;
  answers: { id: string; text: string; correctAnswer?: string }[];
}

// ---------------------------------------------------------------------------
// Sandbox KBA known-correct answers (case-insensitive)
// ---------------------------------------------------------------------------
const SANDBOX_KBA_ANSWERS = [
  "$200 - $249", "$385 - $484", "2021", "5518", "7515",
  "ashwood", "asi medical", "bachelor degree", "bechtelcon", "bethel",
  "bmw x5", "ford f100 pickup", "carroll county bank &",
  "dentist / dental hygienist", "dr ralph alperin md", "dr ira adler",
  "great financial svc", "histo tec laboratory", "iec", "kia sorento",
  "lynn lee const co in", "maggies flowers & gift",
  "morrison mahoney miller", "new hampshire", "sallie mae servicing",
  "sn katz jewelry", "the toronto-dominion bank", "toyota highlander",
  "tuscaloosa", "volkswagen passat", "wells fargo & company",
];

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function pickAnswer(q: KbaQuestion): string | null {
  const candidates = q.answers.filter((a) => !/none of the above/i.test(a.text));
  const noneOpt = q.answers.find((a) => /none of the above/i.test(a.text));

  // Equifax includes correctAnswer:"true" in sandbox
  const correct = q.answers.find((a) => a.correctAnswer === "true");
  if (correct) return correct.id;

  // Exact / partial / starts-with match against known answers
  for (const a of candidates) {
    const n = norm(a.text);
    for (const known of SANDBOX_KBA_ANSWERS) {
      const k = norm(known);
      if (n === k || n.includes(k) || k.includes(n) || n.startsWith(k) || k.startsWith(n)) {
        return a.id;
      }
    }
  }

  return noneOpt ? noneOpt.id : null;
}

function autoAnswer(qs: KbaQuestion[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of qs) {
    const id = pickAnswer(q);
    if (id) out[q.id] = id;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { res, data };
}

async function getJson(url: string) {
  const res = await fetch(url);
  const data = await res.json();
  return { res, data };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CreditReportPage() {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [questions, setQuestions] = useState<KbaQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef(false);

  const log = (msg: string) =>
    setLogs((prev) => [...prev, "[" + new Date().toLocaleTimeString() + "] " + msg]);

  const fail = (msg: string) => {
    setError(msg);
    setStep("error");
    log("ERROR: " + msg);
  };

  // -----------------------------------------------------------------------
  // Order + retrieve report (shared by all verification paths)
  // -----------------------------------------------------------------------
  async function orderAndRetrieve(uid: string, token: string) {
    setStep("ordering-report");
    setStatusMsg("Ordering credit report...");
    log("Ordering report (exp1bReportScore)...");

    const { res: oRes, data: oData } = await postJson("/api/array/order-report", {
      userId: uid,
      userToken: token,
    });
    if (!oRes.ok || !oData.reportKey) {
      fail("Order report failed: " + (oData.error || oData.detail || "unknown"));
      return;
    }
    log("Report ordered: reportKey=" + String(oData.reportKey));

    setStep("loading-report");
    setStatusMsg("Retrieving HTML report (polling)...");
    log("Retrieving HTML report...");

    const rUrl =
      "/api/array/retrieve-report?reportKey=" +
      encodeURIComponent(oData.reportKey) +
      "&displayToken=" +
      encodeURIComponent(oData.displayToken || "");
    const rRes = await fetch(rUrl);
    if (!rRes.ok) {
      const rData = await rRes.json().catch(() => ({}));
      fail("Retrieve report failed: " + (rData.error || String(rRes.status)));
      return;
    }
    const html = await rRes.text();
    setReportHtml(html);
    setStep("done");
    log("Credit report retrieved successfully!");
  }

  // -----------------------------------------------------------------------
  // Strategy 1: Auto-verify (PATCH with server token)
  // -----------------------------------------------------------------------
  async function tryAutoVerify(uid: string): Promise<string | null> {
    log("[auto-verify] Attempting PATCH with server token...");
    try {
      const { res, data } = await postJson("/api/array/auto-verify", { userId: uid });
      if (res.ok && data.userToken) {
        log("[auto-verify] SUCCESS! userToken=" + String(data.userToken));
        return data.userToken as string;
      }
      log("[auto-verify] Failed: " + (data.error || data.detail || String(res.status)));
    } catch (e) {
      log("[auto-verify] Error: " + (e instanceof Error ? e.message : "unknown"));
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Strategy 2: TransUnion OTP (passcode = 12345)
  // -----------------------------------------------------------------------
  async function tryOtp(uid: string): Promise<string | null> {
    log("[otp] Initiating TransUnion OTP...");
    try {
      // Step 1: initiate with tui only
      const { res: qRes, data: qData } = await getJson(
        "/api/array/verify-questions?userId=" + uid + "&provider1=tui"
      );
      if (!qRes.ok || !qData.questions) {
        log("[otp] Initiate failed: " + (qData.error || "no questions"));
        return null;
      }
      log("[otp] authMethod=" + String(qData.authMethod || "unknown") + " provider=" + String(qData.provider));

      // If it returned KBA instead of OTP, bail
      if (qData.authMethod === "kba") {
        log("[otp] Got KBA instead of OTP, skipping");
        return null;
      }

      const q = qData.questions[0];
      if (!q) { log("[otp] No question returned"); return null; }

      // Step 2: pick SMS delivery option (first non-voice answer)
      const smsAnswer = q.answers.find(
        (a: { text: string }) => /text/i.test(a.text) || /sms/i.test(a.text)
      ) || q.answers[0];
      log("[otp] Selecting delivery: " + String(smsAnswer.text));

      const answers1: Record<string, string> = {};
      answers1[q.id] = smsAnswer.id;

      const { data: d2 } = await postJson("/api/array/verify-answers", {
        userId: uid,
        authToken: qData.authToken,
        answers: answers1,
        authPin: "",
      });

      // Expect 206 with passcode prompt
      if (d2.status !== 206 || !d2.questions || !d2.questions[0]) {
        log("[otp] Unexpected response after delivery selection: status=" + String(d2.status));
        // Maybe we already got a userToken
        if (d2.userToken) return d2.userToken as string;
        return null;
      }

      const q2 = d2.questions[0];
      log("[otp] Passcode prompt received. Submitting passcode 12345...");

      const answers2: Record<string, string> = {};
      answers2[q2.id] = q2.answers[0].id;

      const { data: d3 } = await postJson("/api/array/verify-answers", {
        userId: uid,
        authToken: d2.authToken,
        answers: answers2,
        authPin: "12345",
      });

      if (d3.userToken) {
        log("[otp] SUCCESS! userToken=" + String(d3.userToken));
        return d3.userToken as string;
      }
      log("[otp] Failed: " + (d3.error || d3.detail || "no userToken"));
    } catch (e) {
      log("[otp] Error: " + (e instanceof Error ? e.message : "unknown"));
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Strategy 3: Equifax SMFA (poll until customer clicks link)
  // In sandbox, the link-click is simulated automatically
  // -----------------------------------------------------------------------
  async function trySmfa(uid: string): Promise<string | null> {
    log("[smfa] Initiating Equifax SMFA...");
    try {
      const { res: qRes, data: qData } = await getJson(
        "/api/array/verify-questions?userId=" + uid + "&provider1=efx"
      );
      if (!qRes.ok || !qData.questions) {
        log("[smfa] Initiate failed: " + (qData.error || "no questions"));
        return null;
      }
      log("[smfa] authMethod=" + String(qData.authMethod || "unknown"));

      if (qData.authMethod !== "SMFA") {
        log("[smfa] Got " + String(qData.authMethod) + " instead of SMFA, skipping");
        return null;
      }

      // Submit the hard-coded "1":"1" answer and poll
      for (let poll = 0; poll < 15; poll++) {
        if (abortRef.current) return null;
        const hardAnswers: Record<string, string> = { "1": "1" };
        const { data: d } = await postJson("/api/array/verify-answers", {
          userId: uid,
          authToken: qData.authToken,
          answers: hardAnswers,
        });
        if (d.userToken) {
          log("[smfa] SUCCESS! userToken=" + String(d.userToken));
          return d.userToken as string;
        }
        if (d.status === 202) {
          log("[smfa] Waiting for link click... (poll " + String(poll + 1) + ")");
          await sleep(2000);
          continue;
        }
        log("[smfa] Unexpected: " + JSON.stringify(d));
        return null;
      }
      log("[smfa] Timed out waiting for SMFA");
    } catch (e) {
      log("[smfa] Error: " + (e instanceof Error ? e.message : "unknown"));
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Strategy 4: KBA with auto-answer + retry
  // -----------------------------------------------------------------------
  async function tryKba(uid: string, maxRounds: number = 5): Promise<string | null> {
    log("[kba] Initiating KBA (all providers)...");
    try {
      for (let round = 1; round <= maxRounds; round++) {
        if (abortRef.current) return null;
        log("[kba] Round " + String(round) + "/" + String(maxRounds));

        const { res: qRes, data: qData } = await getJson(
          "/api/array/verify-questions?userId=" + uid + "&provider1=tui&provider2=efx&provider3=exp"
        );
        if (!qRes.ok || !qData.questions || qData.questions.length === 0) {
          log("[kba] No questions: " + (qData.error || "empty"));
          return null;
        }
        log("[kba] Got " + String(qData.questions.length) + " questions (provider=" + String(qData.provider) + ")");

        const answers = autoAnswer(qData.questions);
        const ansCount = Object.keys(answers).length;
        log("[kba] Auto-answered " + String(ansCount) + "/" + String(qData.questions.length));

        if (ansCount < qData.questions.length) {
          log("[kba] Could not answer all questions, retrying with new user...");
          return null;
        }

        const { data: aData } = await postJson("/api/array/verify-answers", {
          userId: uid,
          authToken: qData.authToken,
          answers: answers,
        });

        if (aData.userToken) {
          log("[kba] SUCCESS! userToken=" + String(aData.userToken));
          return aData.userToken as string;
        }

        // 206 = more questions, loop again
        if (aData.status === 206 && aData.questions) {
          log("[kba] More questions received, continuing...");
          continue;
        }

        log("[kba] Failed: " + (aData.error || aData.detail || "no userToken"));
      }
    } catch (e) {
      log("[kba] Error: " + (e instanceof Error ? e.message : "unknown"));
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Main: Smart auto-flow with fallback chain
  // -----------------------------------------------------------------------
  async function startSmartFlow() {
    abortRef.current = false;
    setStep("working");
    setError(null);
    setReportHtml(null);
    setQuestions([]);
    setSelectedAnswers({});

    const MAX_ATTEMPTS = 5;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (abortRef.current) { setStep("idle"); return; }

      log("========== ATTEMPT " + String(attempt) + "/" + String(MAX_ATTEMPTS) + " ==========");

      // 1. Create user
      setStatusMsg("Creating sandbox user (attempt " + String(attempt) + ")...");
      log("Creating sandbox user...");
      const { res: cRes, data: cData } = await postJson("/api/array/create-user", {});
      if (!cRes.ok || !cData.userId) {
        log("Create user failed: " + (cData.error || "unknown"));
        continue;
      }
      const uid = cData.userId as string;
      setUserId(uid);
      log("User created: " + uid);

      // 2. Try auto-verify
      setStatusMsg("Trying auto-verify...");
      const t1 = await tryAutoVerify(uid);
      if (t1) { await orderAndRetrieve(uid, t1); return; }

      // 3. Try TransUnion OTP
      if (abortRef.current) { setStep("idle"); return; }
      setStatusMsg("Trying TransUnion OTP...");
      const t2 = await tryOtp(uid);
      if (t2) { await orderAndRetrieve(uid, t2); return; }

      // 4. Try Equifax SMFA
      if (abortRef.current) { setStep("idle"); return; }
      setStatusMsg("Trying Equifax SMFA...");
      const t3 = await trySmfa(uid);
      if (t3) { await orderAndRetrieve(uid, t3); return; }

      // 5. Try KBA
      if (abortRef.current) { setStep("idle"); return; }
      setStatusMsg("Trying KBA auto-answer...");
      const t4 = await tryKba(uid);
      if (t4) { await orderAndRetrieve(uid, t4); return; }

      log("All strategies failed on attempt " + String(attempt) + ", retrying with new user...");
    }

    fail("All verification strategies failed after " + String(MAX_ATTEMPTS) + " attempts.");
  }

  // -----------------------------------------------------------------------
  // Manual step-by-step (KBA only, for users who want to pick answers)
  // -----------------------------------------------------------------------
  async function startManualFlow() {
    setStep("working");
    setError(null);
    setReportHtml(null);
    setStatusMsg("Creating sandbox user...");
    log("Creating sandbox user...");

    const { res: cRes, data: cData } = await postJson("/api/array/create-user", {});
    if (!cRes.ok || !cData.userId) {
      fail("Create user failed: " + (cData.error || "unknown"));
      return;
    }
    const uid = cData.userId as string;
    setUserId(uid);
    log("User created: " + uid);

    setStatusMsg("Fetching KBA questions...");
    log("Fetching KBA questions...");
    const { res: qRes, data: qData } = await getJson(
      "/api/array/verify-questions?userId=" + uid + "&provider1=tui&provider2=efx&provider3=exp"
    );
    if (!qRes.ok || !qData.questions) {
      fail("Fetch questions failed: " + (qData.error || "unknown"));
      return;
    }

    log("Got " + String(qData.questions.length) + " questions (provider=" + String(qData.provider) + ", method=" + String(qData.authMethod || "kba") + ")");
    setQuestions(qData.questions);

    // Auto-fill what we can
    const auto = autoAnswer(qData.questions);
    setSelectedAnswers(auto);
    setStep("answering");
  }

  async function submitManualAnswers() {
    if (!userId) return;
    setStep("working");
    setStatusMsg("Submitting answers...");
    log("Submitting KBA answers...");

    // We need the authToken from the last question fetch — re-fetch to get fresh one
    const { res: qRes, data: qData } = await getJson(
      "/api/array/verify-questions?userId=" + userId + "&provider1=tui&provider2=efx&provider3=exp"
    );
    if (!qRes.ok) {
      fail("Re-fetch questions failed");
      return;
    }

    const { data: aData } = await postJson("/api/array/verify-answers", {
      userId: userId,
      authToken: qData.authToken,
      answers: selectedAnswers,
    });

    if (aData.userToken) {
      log("Verification successful! userToken=" + String(aData.userToken));
      await orderAndRetrieve(userId, aData.userToken as string);
      return;
    }

    fail("Verification failed: " + (aData.error || aData.detail || "incorrect answers"));
  }

  function reset() {
    abortRef.current = true;
    setStep("idle");
    setError(null);
    setStatusMsg("");
    setUserId(null);
    setQuestions([]);
    setSelectedAnswers({});
    setReportHtml(null);
    setLogs([]);
  }

  const isWorking = step === "working" || step === "ordering-report" || step === "loading-report";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Array Credit Report</h1>
        {step !== "idle" && (
          <button onClick={reset} className="text-sm text-muted-foreground underline hover:text-foreground">
            Start Over
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Sandbox flow: Create User &rarr; Verify Identity &rarr; Order Report &rarr; View Report
      </p>

      {/* Progress indicator */}
      <div className="flex gap-2 text-xs flex-wrap">
        {[
          { key: "create", label: "1. Create User", active: step === "idle" || (isWorking && statusMsg.includes("Creating")) },
          { key: "verify", label: "2. Verify", active: step === "answering" || (isWorking && (statusMsg.includes("Trying") || statusMsg.includes("Submitting") || statusMsg.includes("Fetching"))) },
          { key: "order", label: "3. Order Report", active: step === "ordering-report" },
          { key: "view", label: "4. View Report", active: step === "loading-report" || step === "done" },
        ].map(({ key, label, active }) => (
          <span
            key={key}
            className={"px-3 py-1 rounded-full border " + (active ? "bg-blue-600 text-white border-blue-600" : "bg-muted text-muted-foreground border-border")}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          <p className="font-medium">Error</p>
          <p>{error}</p>
          <button onClick={reset} className="mt-2 text-sm underline">Start Over</button>
        </div>
      )}

      {/* Idle */}
      {step === "idle" && (
        <div className="rounded-lg border p-6 text-center space-y-4">
          <p className="text-sm">
            Create a sandbox user (<strong>Thomas Devos</strong>) and verify identity to retrieve a credit report.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={startSmartFlow}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Auto (tries all methods)
            </button>
            <button
              onClick={startManualFlow}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Manual (KBA questions)
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Auto tries: server auto-verify &rarr; TransUnion OTP (12345) &rarr; Equifax SMFA &rarr; KBA auto-answer
          </p>
        </div>
      )}

      {/* Working spinner */}
      {isWorking && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-sm text-muted-foreground">{statusMsg}</span>
          </div>
          <button
            onClick={() => { abortRef.current = true; }}
            className="text-xs text-red-600 underline hover:text-red-700"
          >
            Stop
          </button>
        </div>
      )}

      {/* Manual KBA */}
      {step === "answering" && questions.length > 0 && (
        <div className="space-y-6">
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-sm font-medium mb-1">Identity Verification (KBA)</p>
            <p className="text-xs text-muted-foreground">
              User ID: <code className="text-xs">{userId}</code>
            </p>
          </div>

          {questions.map((q, i) => (
            <div key={q.id} className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">{i + 1}. {q.text}</p>
              <div className="space-y-2">
                {q.answers.map((a) => (
                  <label
                    key={a.id}
                    className={"flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors " +
                      (selectedAnswers[q.id] === a.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-border hover:bg-muted/50")}
                  >
                    <input
                      type="radio"
                      name={"q-" + q.id}
                      value={a.id}
                      checked={selectedAnswers[q.id] === a.id}
                      onChange={() => setSelectedAnswers((prev) => ({ ...prev, [q.id]: a.id }))}
                      className="accent-blue-600"
                    />
                    <span className="text-sm">{a.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-3">
            <button
              onClick={startSmartFlow}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Switch to Auto
            </button>
            <button
              onClick={submitManualAnswers}
              disabled={Object.keys(selectedAnswers).length < questions.length}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit ({Object.keys(selectedAnswers).length}/{questions.length})
            </button>
          </div>
        </div>
      )}

      {/* Report */}
      {step === "done" && reportHtml && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950 text-sm text-green-700 dark:text-green-300">
            Credit report retrieved successfully!
          </div>
          <div className="rounded-lg border overflow-hidden">
            <iframe
              srcDoc={reportHtml}
              className="w-full border-none"
              style={{ minHeight: "80vh" }}
              title="Credit Report"
            />
          </div>
        </div>
      )}

      {/* Debug log */}
      {logs.length > 0 && (
        <details open={step === "error"} className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Debug Log ({logs.length} entries)
          </summary>
          <pre className="mt-2 p-3 rounded-lg bg-muted overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
            {logs.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}
