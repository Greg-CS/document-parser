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
  const [fromValue, setFromValue] = React.useState("");
  const [pagesValue, setPagesValue] = React.useState("1");
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

  const placeholderLetter = React.useMemo(() => {
    const date = new Date().toLocaleDateString();
    const parsedSummary = parsed ? "Parsed data is available." : "";
    const selectedLines = items.map((i) => `- ${i.label}: ${i.value}`);

    return [
      `Date: ${date}`,
      "",
      "To Whom It May Concern,",
      "",
      `I am writing regarding information contained in my ${kindLabel} document "${fileName}".`,
      "",
      "This is a placeholder letter generator.",
      "In the next step, this will stream letter text generated from your parsed fields and selected negative items.",
      items.length > 0 ? "" : "",
      items.length > 0 ? "Selected items:" : "",
      ...selectedLines,
      "",
      parsedSummary,
      "",
      "Sincerely,",
      "[Your Name]",
    ]
      .filter(Boolean)
      .join("\n");
  }, [fileName, items, kindLabel, parsed]);

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Source: <span className="font-medium text-foreground">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
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
            <Button type="button" variant="outline" size="sm" onClick={startStreaming} disabled={isStreaming}>
              {isStreaming ? "Streaming…" : "Replay"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">From</div>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              value={fromValue}
              onChange={(e) => setFromValue(e.target.value)}
              placeholder="Your Name, Address, City, ST ZIP"
            />
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">Letter stream</div>
            <pre className="max-h-[320px] overflow-auto p-4 text-xs leading-5 text-foreground wrap-break-word">
              {streamText}
            </pre>
          </div>

          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">Preview</div>
            <pre className="max-h-[320px] overflow-auto p-4 text-xs leading-5 text-foreground wrap-break-word">
              {placeholderLetter}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
