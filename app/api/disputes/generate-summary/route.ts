import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

interface DisputeItemSummary {
  category: string;
  severity: string;
  creditorName?: string;
  fieldName: string;
  reason: string;
}

interface RequestBody {
  items: DisputeItemSummary[];
  counts: {
    high: number;
    medium: number;
    low: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { items, counts } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are a credit repair expert helping a consumer understand their credit report issues. 
    
Based on the following dispute items found in their credit report, provide a brief, encouraging summary (2-3 sentences max) that:
1. Acknowledges the issues found
2. Provides actionable guidance on priority
3. Uses simple, encouraging language

Dispute Items Summary:
- High Severity: ${counts.high} items (collections, charge-offs, 90+ days late)
- Medium Severity: ${counts.medium} items (60 days late, derogatory marks)  
- Low Severity: ${counts.low} items (30 days late, minor errors)

Sample items:
${items.slice(0, 10).map(i => `- ${i.creditorName || 'Unknown'}: ${i.reason} (${i.severity})`).join('\n')}

Respond with ONLY the summary text, no formatting or labels. Keep it under 100 words and make it actionable.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text().trim();

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Error generating summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
