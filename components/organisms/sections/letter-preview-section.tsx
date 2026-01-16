"use client";

import * as React from "react";

import { Button } from "@/components/atoms/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";

// Letter template types
type LetterTemplateType = "cra" | "creditor" | "collection" | "generic";

function isRedactedString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length >= 4 && /^X+$/i.test(lettersOnly)) return true;
  if (/\bREDACTED\b/i.test(trimmed)) return true;

  return false;
}

function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path
    .replace(/\[\*\]/g, ".0")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function findFirstStringInSubtree(
  node: unknown,
  keyPredicate: (key: string) => boolean
): string | undefined {
  if (node === null || node === undefined) return undefined;

  if (typeof node === "string") {
    const trimmed = node.trim();
    if (!trimmed) return undefined;
    if (isRedactedString(trimmed)) return undefined;
    return trimmed;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstStringInSubtree(item, keyPredicate);
      if (found) return found;
    }
    return undefined;
  }

  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (keyPredicate(k) && typeof v === "string" && v.trim() && !isRedactedString(v)) return v.trim();
    }
    for (const v of Object.values(node as Record<string, unknown>)) {
      const found = findFirstStringInSubtree(v, keyPredicate);
      if (found) return found;
    }
  }

  return undefined;
}

function findBorrowerNode(parsed: unknown): unknown {
  const direct =
    getValueAtPath(parsed, "CREDIT_RESPONSE.BORROWER") ??
    getValueAtPath(parsed, "CREDIT_RESPONSE._BORROWER") ??
    getValueAtPath(parsed, "BORROWER") ??
    getValueAtPath(parsed, "_BORROWER");
  if (direct) return direct;

  const stack: unknown[] = [parsed];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      for (const it of cur) stack.push(it);
      continue;
    }
    const rec = cur as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (k.toUpperCase() === "BORROWER" || k.toUpperCase() === "_BORROWER") return v;
      stack.push(v);
    }
  }

  return undefined;
}

function extractConsumerName(parsed: unknown): string {
  const borrower = findBorrowerNode(parsed);
  const direct =
    (typeof getValueAtPath(borrower, "@_FullName") === "string" ? (getValueAtPath(borrower, "@_FullName") as string) : undefined) ??
    (typeof getValueAtPath(borrower, "_NAME.@_FullName") === "string" ? (getValueAtPath(borrower, "_NAME.@_FullName") as string) : undefined) ??
    (typeof getValueAtPath(borrower, "NAME.@_FullName") === "string" ? (getValueAtPath(borrower, "NAME.@_FullName") as string) : undefined);

  if (direct && direct.trim() && !isRedactedString(direct)) return direct.trim();

  const found = findFirstStringInSubtree(borrower, (k) => {
    const up = k.toUpperCase();
    return up.includes("FULLNAME") || up === "@_FULLNAME";
  });
  return found ?? "";
}

function extractConsumerAddress(parsed: unknown): string {
  const borrower = findBorrowerNode(parsed);

  const street = findFirstStringInSubtree(borrower, (k) => {
    const up = k.toUpperCase();
    return (
      up.includes("STREET") ||
      up.includes("ADDRESSLINE") ||
      up === "ADDRESS1" ||
      up === "ADDRESS" ||
      up.includes("STREETADDRESS")
    );
  });
  const city = findFirstStringInSubtree(borrower, (k) => k.toUpperCase() === "CITY");
  const state = findFirstStringInSubtree(borrower, (k) => {
    const up = k.toUpperCase();
    return up === "STATE" || up === "STATECODE" || up.endsWith("STATE");
  });
  const zip = findFirstStringInSubtree(borrower, (k) => {
    const up = k.toUpperCase();
    return up === "ZIP" || up === "ZIPCODE" || up.includes("POSTAL");
  });

  const line1 = street?.trim();
  const line2 = [city?.trim(), state?.trim(), zip?.trim()].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join(", ");
}

interface LetterTemplate {
  id: LetterTemplateType;
  label: string;
  description: string;
  generate: (params: {
    date: string;
    consumerName: string;
    consumerAddress: string;
    recipientName: string;
    items: Array<{ label: string; value: string }>;
    accountInfo?: string;
  }) => string;
}

// CRA Dispute Letter Template (for TransUnion, Experian, Equifax)
const CRA_TEMPLATE: LetterTemplate = {
  id: "cra",
  label: "CRA Dispute",
  description: "Dispute letter to Credit Reporting Agencies (TransUnion, Experian, Equifax)",
  generate: ({ date, consumerName, consumerAddress, recipientName, items }) => {
    const itemsList = items.map((i) => `• ${i.label}: ${i.value}`).join("\n");
    return `${date}

${recipientName}
Consumer Dispute Department

Re: Dispute of Inaccurate Credit Information

To Whom It May Concern:

I am writing to dispute the following information in my credit file. The items I dispute are indicated below:

${itemsList || "[No specific items selected]"}

I am disputing these items because the information is [inaccurate/incomplete/unverifiable]. Under the Fair Credit Reporting Act (FCRA), Section 611 (15 U.S.C. § 1681i), you are required to conduct a reasonable investigation into the disputed information within 30 days of receiving this letter.

Please investigate this matter and correct or delete the disputed items as required by law. I request that you send me a copy of my corrected credit report upon completion of your investigation.

I have enclosed copies of documents supporting my dispute for your review.

Sincerely,

${consumerName || "[Your Name]"}
${consumerAddress || "[Your Address]"}

Enclosures: [List any supporting documents]`;
  },
};

// Creditor Dispute Letter Template (for original creditors)
const CREDITOR_TEMPLATE: LetterTemplate = {
  id: "creditor",
  label: "Creditor Dispute",
  description: "Dispute letter to original creditors for account inaccuracies",
  generate: ({ date, consumerName, consumerAddress, recipientName, items, accountInfo }) => {
    const itemsList = items.map((i) => `• ${i.label}: ${i.value}`).join("\n");
    return `${date}

${recipientName}
Customer Service / Disputes Department

Re: Dispute of Account Information
${accountInfo ? `Account Reference: ${accountInfo}` : ""}

To Whom It May Concern:

I am writing to dispute information you are reporting to the credit bureaus regarding my account. The specific items I am disputing are:

${itemsList || "[No specific items selected]"}

I believe this information is inaccurate and request that you investigate this matter and correct your records accordingly. Please also notify the credit reporting agencies (TransUnion, Experian, and Equifax) to update or remove this inaccurate information from my credit file.

Under the Fair Credit Reporting Act (FCRA), you are required to report accurate information to the credit bureaus. Reporting inaccurate information may constitute a violation of the FCRA.

Please respond to this dispute within 30 days with the results of your investigation.

Sincerely,

${consumerName || "[Your Name]"}
${consumerAddress || "[Your Address]"}`;
  },
};

// Collection Agency Dispute Letter Template
const COLLECTION_TEMPLATE: LetterTemplate = {
  id: "collection",
  label: "Collection Dispute",
  description: "Debt validation and dispute letter to collection agencies",
  generate: ({ date, consumerName, consumerAddress, recipientName, items, accountInfo }) => {
    const itemsList = items.map((i) => `• ${i.label}: ${i.value}`).join("\n");
    return `${date}

${recipientName}

Re: Debt Validation Request and Dispute
${accountInfo ? `Reference: ${accountInfo}` : ""}

To Whom It May Concern:

I am writing in response to your attempt to collect a debt. I dispute this debt and request validation pursuant to the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g.

The items I am disputing include:

${itemsList || "[No specific items selected]"}

Please provide the following documentation:

1. Proof that you are licensed to collect debts in my state
2. The original signed contract or agreement with my signature
3. Complete payment history from the original creditor
4. Proof that you own or are authorized to collect this debt
5. Verification that the statute of limitations has not expired

Until you provide proper validation, you must cease all collection activities and remove any negative reporting to the credit bureaus.

This is not a refusal to pay, but a request for validation as provided by law. Please respond within 30 days.

Sincerely,

${consumerName || "[Your Name]"}
${consumerAddress || "[Your Address]"}

Sent via Certified Mail, Return Receipt Requested`;
  },
};

// Generic Dispute Letter Template
const GENERIC_TEMPLATE: LetterTemplate = {
  id: "generic",
  label: "Generic Dispute",
  description: "General purpose dispute letter",
  generate: ({ date, consumerName, consumerAddress, recipientName, items }) => {
    const itemsList = items.map((i) => `• ${i.label}: ${i.value}`).join("\n");
    return `${date}

${recipientName}

Re: Dispute of Information

To Whom It May Concern:

I am writing to dispute the following information:

${itemsList || "[No specific items selected]"}

I believe this information is inaccurate and request that you investigate and correct your records.

Please respond within 30 days with the results of your investigation.

Sincerely,

${consumerName || "[Your Name]"}
${consumerAddress || "[Your Address]"}`;
  },
};

const LETTER_TEMPLATES: LetterTemplate[] = [
  CRA_TEMPLATE,
  CREDITOR_TEMPLATE,
  COLLECTION_TEMPLATE,
  GENERIC_TEMPLATE,
];

export function LetterPreviewSection({
  fileName,
  kindLabel,
  parsed,
  items,
  setItems,
}: {
  fileName: string;
  kindLabel: string;
  parsed: unknown;
  items: Array<{ label: string; value: string }>;
  setItems: React.Dispatch<React.SetStateAction<Array<{ label: string; value: string }>>>;
}) {
  const [selectedTemplate, setSelectedTemplate] = React.useState<LetterTemplateType>("cra");
  const [consumerName, setConsumerName] = React.useState("");
  const [fromValue, setFromValue] = React.useState("");
  const [pagesValue, setPagesValue] = React.useState("1");
  const [accountInfo, setAccountInfo] = React.useState("");
  const [disputeCriteria, setDisputeCriteria] = React.useState("");
  const [submitStatus, setSubmitStatus] = React.useState<
    | { state: "idle" }
    | { state: "submitting" }
    | { state: "error"; message: string }
    | { state: "success"; contentType: string; body: string }
  >({ state: "idle" });

  const [recipients, setRecipients] = React.useState<
    Array<{
      name1: string;
      name2: string;
      address1: string;
      address2: string;
      address3: string;
      city: string;
      state: string;
      zip: string;
    }>
  >([
    {
      name1: "",
      name2: "",
      address1: "",
      address2: "",
      address3: "",
      city: "",
      state: "",
      zip: "",
    },
  ]);

  React.useEffect(() => {
    if (!parsed) return;

    setConsumerName((prev) => {
      if (prev.trim().length > 0) return prev;
      return extractConsumerName(parsed);
    });

    setFromValue((prev) => {
      if (prev.trim().length > 0) return prev;
      return extractConsumerAddress(parsed);
    });
  }, [parsed]);

  const currentTemplate = React.useMemo(
    () => LETTER_TEMPLATES.find((t) => t.id === selectedTemplate) ?? GENERIC_TEMPLATE,
    [selectedTemplate]
  );

  const placeholderLetter = React.useMemo(() => {
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    // Get recipient name from first recipient if available
    const recipientName = recipients[0]?.name1 || "[Recipient Name]";
    
    return currentTemplate.generate({
      date,
      consumerName,
      consumerAddress: fromValue,
      recipientName,
      items,
      accountInfo: accountInfo || undefined,
    });
  }, [currentTemplate, consumerName, fromValue, recipients, items, accountInfo]);

  const [streamText, setStreamText] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);

  const startStreaming = React.useCallback(() => {
    setStreamText("");
    setIsStreaming(true);

    let i = 0;
    const interval = window.setInterval(() => {
      i++;
      setStreamText(placeholderLetter.slice(0, i));
      if (i >= placeholderLetter.length) {
        window.clearInterval(interval);
        setIsStreaming(false);
      }
    }, 10);

    return () => window.clearInterval(interval);
  }, [placeholderLetter]);

  React.useEffect(() => {
    const cleanup = startStreaming();
    return cleanup;
  }, [startStreaming]);

  const handleSubmit = React.useCallback(async () => {
    const from = fromValue.trim();

    const toStrings = recipients
      .map((r) => {
        const parts = [
          r.name1,
          r.name2,
          r.address1,
          r.address2,
          r.address3,
          r.city,
          r.state,
          r.zip,
        ].map((p) => p.trim());
        return parts.join("|");
      })
      .filter((s) => s.replace(/\|/g, "").trim().length > 0);

    const hasOneValidRecipient = recipients.some((r) =>
      [r.name1, r.address1, r.city, r.state, r.zip].every((v) => v.trim().length > 0)
    );

    if (!from || !hasOneValidRecipient) {
      setSubmitStatus({
        state: "error",
        message:
          "Enter a From address and at least one recipient (name1, address1, city, state, zip are required).",
      });
      return;
    }

    setSubmitStatus({ state: "submitting" });

    try {
      const form = new FormData();
      form.append("pages", pagesValue || "1");
      form.append("from", from);
      for (const r of toStrings) form.append("to[]", r);
      form.append("letterText", placeholderLetter);

      const res = await fetch("/api/letterstream/submit", {
        method: "POST",
        body: form,
      });

      const contentType = res.headers.get("content-type") ?? "text/plain";
      const body = await res.text();

      if (!res.ok) {
        let message = `Submit failed (${res.status})`;
        try {
          const parsedErr = JSON.parse(body) as { error?: string };
          if (parsedErr?.error) message = parsedErr.error;
        } catch {
          if (body) message = body;
        }
        setSubmitStatus({ state: "error", message });
        return;
      }

      setSubmitStatus({ state: "success", contentType, body });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to submit";
      setSubmitStatus({ state: "error", message });
    }
  }, [fromValue, pagesValue, placeholderLetter, recipients]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Letter</CardTitle>
        <CardDescription>Placeholder letter stream + preview (will be generated from parsed data).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Selection */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Letter Template</div>
          <div className="flex flex-wrap gap-2">
            {LETTER_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplate(template.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  selectedTemplate === template.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
                title={template.description}
              >
                {template.label}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">{currentTemplate.description}</div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Source: <span className="font-medium text-foreground">{fileName}</span>
            {kindLabel ? <span className="text-muted-foreground"> ({kindLabel})</span> : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={startStreaming} disabled={isStreaming}>
            {isStreaming ? "Streaming…" : "Replay"}
          </Button>
        </div>

        {/* Letter Preview */}
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">
            Letter Preview ({currentTemplate.label})
          </div>
          <pre className="max-h-[320px] overflow-auto p-4 text-xs leading-5 text-foreground whitespace-pre-wrap">
            {streamText}
          </pre>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Your Name</div>
              <input
                className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                value={consumerName}
                onChange={(e) => setConsumerName(e.target.value)}
                placeholder="Your Full Name"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Your Address</div>
              <input
                className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                value={fromValue}
                onChange={(e) => setFromValue(e.target.value)}
                placeholder="Address, City, ST ZIP"
              />
            </div>
            {(selectedTemplate === "creditor" || selectedTemplate === "collection") && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Account Reference</div>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                  value={accountInfo}
                  onChange={(e) => setAccountInfo(e.target.value)}
                  placeholder="Account # or Reference"
                />
              </div>
            )}
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Dispute Criteria</div>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                value={disputeCriteria}
                onChange={(e) => setDisputeCriteria(e.target.value)}
              >
                <option value="">Pick one...</option>
                <option value="hard_inquiry">Hard Inquiry</option>
                <option value="late_payment">Late Payment</option>
                <option value="collection">Collection Account</option>
                <option value="charge_off">Charge-Off</option>
                <option value="incorrect_balance">Incorrect Balance</option>
                <option value="not_mine">Account Not Mine</option>
                <option value="identity_theft">Identity Theft</option>
                <option value="outdated">Outdated Information</option>
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Pages</div>
              <input
                className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                value={pagesValue}
                onChange={(e) => setPagesValue(e.target.value)}
                inputMode="numeric"
                placeholder="1"
              />
              <div className="text-[11px] text-muted-foreground">Required by LetterStream. Keep as 1 for now.</div>
            </div>
          </div>
          <div className="space-y-1 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-muted-foreground">Recipients</div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setRecipients((prev) => [
                    ...prev,
                    {
                      name1: "",
                      name2: "",
                      address1: "",
                      address2: "",
                      address3: "",
                      city: "",
                      state: "",
                      zip: "",
                    },
                  ])
                }
              >
                Add recipient
              </Button>
            </div>

            <div className="space-y-3">
              {recipients.map((r, idx) => (
                <div key={idx} className="rounded-lg border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-muted-foreground">Recipient #{idx + 1}</div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={recipients.length === 1}
                      onClick={() => setRecipients((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                      value={r.name1}
                      onChange={(e) =>
                        setRecipients((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, name1: e.target.value } : p))
                        )
                      }
                      placeholder="Name line 1 (required)"
                    />
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                      value={r.name2}
                      onChange={(e) =>
                        setRecipients((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, name2: e.target.value } : p))
                        )
                      }
                      placeholder="Name line 2 (optional)"
                    />
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                      value={r.address1}
                      onChange={(e) =>
                        setRecipients((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, address1: e.target.value } : p))
                        )
                      }
                      placeholder="Address line 1 (required)"
                    />
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                      value={r.address2}
                      onChange={(e) =>
                        setRecipients((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, address2: e.target.value } : p))
                        )
                      }
                      placeholder="Address line 2 (optional)"
                    />
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                      value={r.address3}
                      onChange={(e) =>
                        setRecipients((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, address3: e.target.value } : p))
                        )
                      }
                      placeholder="Address line 3 (optional)"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:col-span-2">
                      <input
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                        value={r.city}
                        onChange={(e) =>
                          setRecipients((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, city: e.target.value } : p))
                          )
                        }
                        placeholder="City (required)"
                      />
                      <input
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                        value={r.state}
                        onChange={(e) =>
                          setRecipients((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, state: e.target.value } : p))
                          )
                        }
                        placeholder="ST (required)"
                      />
                      <input
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                        value={r.zip}
                        onChange={(e) =>
                          setRecipients((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, zip: e.target.value } : p))
                          )
                        }
                        placeholder="ZIP (required)"
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-muted-foreground">
                    API format: name1|name2|address1|address2|address3|city|state|zip
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems([])}
            disabled={items.length === 0}
          >
            Clear items
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={submitStatus.state === "submitting"}
          >
            {submitStatus.state === "submitting" ? "Submitting…" : "Submit"}
          </Button>
        </div>

        {submitStatus.state === "error" ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-foreground">
            {submitStatus.message}
          </div>
        ) : submitStatus.state === "success" ? (
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
              <div className="text-xs font-medium text-muted-foreground">Submit response</div>
              <div className="text-xs text-muted-foreground">{submitStatus.contentType}</div>
            </div>
            <pre className="max-h-[220px] overflow-auto p-4 text-xs leading-5 text-foreground wrap-break-word">
              {submitStatus.body}
            </pre>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
              <div className="text-xs font-medium text-muted-foreground">Included items</div>
              <div className="text-xs text-muted-foreground">{items.length}</div>
            </div>
            <div className="max-h-[200px] overflow-auto divide-y">
              {items.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-muted-foreground" title={item.label}>
                      {item.label}
                    </div>
                    <div className="mt-1 wrap-break-word text-sm text-foreground">{item.value}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setItems((prev) => prev.filter((p) => p.label !== item.label))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Click <span className="font-medium text-foreground">Send to letter</span> on a negative item to include it here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
