import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || "" });

type ReasonOption = { id: string; label: string; group: "cra" | "creditor" | "collection" };

type SuggestReasonRequest = {
  dispute: {
    id: string;
    category?: string;
    bureau?: string;
    fieldPath?: string;
    value?: unknown;
    reason?: string;
    creditorName?: string;
    accountIdentifier?: string;
    severity?: string;
  };
  options: ReasonOption[];
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_AI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as SuggestReasonRequest;

    if (!body || typeof body !== "object" || !body.dispute || !Array.isArray(body.options)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (body.options.length === 0) {
      return NextResponse.json({ error: "No options provided" }, { status: 400 });
    }

    const dispute = body.dispute;
    const options = body.options;

    const optionsText = options
      .map((o) => `- (${o.group}) ${o.label} [id=${o.id}]`)
      .join("\n");

    const prompt = `You help choose the best dispute reason from a fixed list.

Dispute context (may be incomplete):
- creditorName: ${dispute.creditorName ?? ""}
- accountIdentifier: ${dispute.accountIdentifier ?? ""}
- bureau: ${dispute.bureau ?? ""}
- category: ${dispute.category ?? ""}
- fieldPath: ${dispute.fieldPath ?? ""}
- value: ${typeof dispute.value === "string" ? dispute.value : JSON.stringify(dispute.value ?? "")}
- reason label (existing): ${dispute.reason ?? ""}
- severity: ${dispute.severity ?? ""}

Available reason options:
${optionsText}

Rules:
- Pick exactly ONE option from the list.
- Output valid JSON only.
- Use non-assertive language in the summary (e.g. "may", "appears", "could").

Return JSON with this shape:
{"id":"<option id>","label":"<option label>","group":"cra|creditor|collection","summary":"<1-2 sentences>"}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ text: prompt }],
    });

    const text = response.text?.trim() ?? "";

    // Try to parse JSON directly; if model wraps it, extract first JSON object.
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Failed to parse model output", raw: text }, { status: 500 });
    }

    const rec = parsed as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : "";
    const label = typeof rec.label === "string" ? rec.label : "";
    const summary = typeof rec.summary === "string" ? rec.summary : "";

    const selected = options.find((o) => o.id === id) ?? options.find((o) => o.label === label);
    if (!selected) {
      return NextResponse.json({ error: "Model selected an unknown option", raw: text }, { status: 500 });
    }

    return NextResponse.json({
      selected: { id: selected.id, label: selected.label, group: selected.group },
      summary,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to suggest reason";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
