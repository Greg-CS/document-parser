import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Initialize the Google GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || "" });

interface DisputeItem {
  label: string;
  value: string;
  reason?: string;
  creditorName?: string;
}

interface FileAttachment {
  data: string; // Base64 encoded file data
  mimeType: string; // e.g., "application/pdf", "text/html", "application/json"
  fileName?: string;
}

interface GenerateLetterRequest {
  templateType: "cra" | "creditor" | "collection" | "generic";
  consumerName: string;
  consumerAddress: string;
  recipientName: string;
  items: DisputeItem[];
  accountInfo?: string;
  files?: FileAttachment[]; // Optional file attachments for better context
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateLetterRequest;
    const { templateType, consumerName, consumerAddress, recipientName, items, accountInfo, files } = body;

    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_AI_API_KEY not configured. Please set it in your environment variables." },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "No dispute items provided" },
        { status: 400 }
      );
    }

    const itemsList = items
      .map((i) => `- ${i.label}: ${i.value}${i.reason ? ` (Reason: ${i.reason})` : ""}`)
      .join("\n");

    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const templateInstructions = getTemplateInstructions(templateType);

    const promptText = `You are an expert credit dispute letter writer. Generate a professional, legally-compliant dispute letter based on the following information:

**Letter Type:** ${templateType.toUpperCase()} Dispute Letter
**Date:** ${currentDate}
**Consumer Name:** ${consumerName || "[Consumer Name]"}
**Consumer Address:** ${consumerAddress || "[Consumer Address]"}
**Recipient:** ${recipientName || "[Recipient Name]"}
${accountInfo ? `**Account Reference:** ${accountInfo}` : ""}

**Disputed Items:**
${itemsList}

${templateInstructions}

${files && files.length > 0 ? `**IMPORTANT:** I have attached the original credit report file(s) for your reference. Please analyze the document(s) carefully to:
1. Extract additional relevant details about the disputed items
2. Identify specific account numbers, dates, and amounts from the report
3. Reference specific sections or pages where inaccuracies appear
4. Use exact wording from the report when describing discrepancies

` : ""}
**Important Guidelines:**
1. Be professional and assertive but not aggressive
2. Reference relevant laws (FCRA, FDCPA as applicable)
3. Request specific actions and a response within 30 days
4. Include a clear statement that this is a formal dispute
5. Do not include any placeholder text - use the provided information
6. Format the letter properly with date, addresses, salutation, body, and closing
${files && files.length > 0 ? "7. Reference specific details from the attached credit report document(s)" : ""}

Generate the complete dispute letter:`;

    // Build contents array with text and optional file attachments
    const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: promptText }
    ];

    // Add file attachments if provided
    if (files && files.length > 0) {
      for (const file of files) {
        contents.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.data, // Already base64 encoded
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: contents,
    });

    const letterText = response.text;

    return NextResponse.json({
      success: true,
      letter: letterText,
      metadata: {
        templateType,
        itemCount: items.length,
        filesAttached: files?.length || 0,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating letter:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate letter" },
      { status: 500 }
    );
  }
}

function getTemplateInstructions(templateType: string): string {
  switch (templateType) {
    case "cra":
      return `**Template Instructions (CRA Dispute):**
- Address to the Credit Reporting Agency's Consumer Dispute Department
- Reference the Fair Credit Reporting Act (FCRA), Section 611 (15 U.S.C. § 1681i)
- Request a reasonable investigation within 30 days
- Request deletion or correction of disputed items
- Request a copy of the corrected credit report`;

    case "creditor":
      return `**Template Instructions (Creditor Dispute):**
- Address to the creditor's Customer Service / Disputes Department
- Reference the FCRA requirement to report accurate information
- Request investigation and correction of records
- Request notification to credit bureaus for correction
- Mention potential FCRA violations for reporting inaccurate information`;

    case "collection":
      return `**Template Instructions (Collection Agency Dispute):**
- Reference the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g
- Request debt validation with specific documentation
- List required validation documents (original contract, payment history, etc.)
- State that collection activities must cease until validation is provided
- Include "Sent via Certified Mail, Return Receipt Requested" at the end`;

    default:
      return `**Template Instructions (Generic Dispute):**
- Keep the letter professional and straightforward
- Clearly state the disputed information
- Request investigation and response within 30 days`;
  }
}
