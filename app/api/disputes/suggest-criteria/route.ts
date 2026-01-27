import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || "" });

type CriteriaOption = { value: string; label: string };

const CRITERIA_OPTIONS: CriteriaOption[] = [
  { value: "hard_inquiry", label: "Hard Inquiry" },
  { value: "late_payment", label: "Late Payment" },
  { value: "collection", label: "Collection Account" },
  { value: "charge_off", label: "Charge-Off" },
  { value: "incorrect_balance", label: "Incorrect Balance" },
  { value: "not_mine", label: "Account Not Mine" },
  { value: "identity_theft", label: "Identity Theft" },
  { value: "outdated", label: "Outdated Information" },
];

type SuggestCriteriaRequest = {
  items: Array<{ label: string; value: string }>;
  context?: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
    }

    const body = (await req.json()) as SuggestCriteriaRequest;
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const itemsText = body.items.map((i) => `- ${i.label}: ${i.value}`).join("\n");
    const optionsText = CRITERIA_OPTIONS.map((o) => `- ${o.label} (value=${o.value})`).join("\n");

    const prompt = `You help pick the best dispute criteria for a credit dispute letter.

Dispute items to include:
${itemsText}

Available criteria options:
${optionsText}

Pick the single best criteria that covers these items. Output JSON only:
{"value":"<option value>","label":"<option label>","summary":"<1 sentence why>"}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ text: prompt }],
    });

    const text = response.text?.trim() ?? "";
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Failed to parse model output" }, { status: 500 });
    }

    const rec = parsed as Record<string, unknown>;
    const value = typeof rec.value === "string" ? rec.value : "";
    const label = typeof rec.label === "string" ? rec.label : "";
    const summary = typeof rec.summary === "string" ? rec.summary : "";

    const selected = CRITERIA_OPTIONS.find((o) => o.value === value) ?? CRITERIA_OPTIONS.find((o) => o.label === label);
    if (!selected) {
      return NextResponse.json({ error: "Unknown criteria selected" }, { status: 500 });
    }

    return NextResponse.json({ selected: { value: selected.value, label: selected.label }, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to suggest criteria";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
