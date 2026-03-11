import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/prisma-node";
import { computeReportFingerprint } from "@/lib/report-fingerprint";
import { extractUniversalFields } from "@/lib/extract-universal-fields";

export const runtime = "nodejs";

/**
 * POST /api/credit-reports/save
 * Save a credit report from Array API or other sources
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, sourceType, parsedData, userId } = body;

    console.log("[SAVE CREDIT REPORT] Request received:", { filename, sourceType, userId: userId || "none" });

    if (!filename || !sourceType || !parsedData) {
      console.error("[SAVE CREDIT REPORT] Missing required fields");
      return NextResponse.json(
        { error: "filename, sourceType, and parsedData are required" },
        { status: 400 }
      );
    }

    // Compute hash and fingerprint
    const dataString = JSON.stringify(parsedData);
    const sha256 = createHash("sha256").update(dataString).digest("hex");
    const reportFingerprint = computeReportFingerprint(parsedData);

    console.log("[SAVE CREDIT REPORT] Computed sha256:", sha256);
    console.log("[SAVE CREDIT REPORT] Computed fingerprint:", reportFingerprint);

    // Check if report already exists
    const existing = await prisma.creditReport.findFirst({
      where: { sha256 },
    });

    if (existing) {
      console.log("[SAVE CREDIT REPORT] Report already exists:", existing.id);
      return NextResponse.json({
        item: {
          id: existing.id,
          filename: existing.filename,
          sourceType: existing.sourceType,
          uploadedAt: existing.uploadedAt,
          reportFingerprint: existing.reportFingerprint,
        },
      });
    }

    // Extract universal fields from parsed data
    const universalFields = extractUniversalFields(parsedData as Record<string, unknown>);
    console.log("[SAVE CREDIT REPORT] Extracted universal fields:", universalFields);

    // Create new credit report
    console.log("[SAVE CREDIT REPORT] Creating new credit report");
    const creditReport = await prisma.creditReport.create({
      data: {
        filename,
        mimeType: "application/json",
        fileSize: dataString.length,
        sourceType,
        rawText: dataString,
        rawBytes: null,
        parsedData,
        sha256,
        storageProvider: "db",
        reportFingerprint,
        userId: userId || null,
        // Universal fields
        firstName: universalFields.firstName,
        lastName: universalFields.lastName,
        ssnLast4: universalFields.ssnLast4,
        dateOfBirth: universalFields.dateOfBirth,
        accountNumber: universalFields.accountNumber,
        accountType: universalFields.accountType,
        accountStatus: universalFields.accountStatus,
        balance: universalFields.balance,
        openedDate: universalFields.openedDate,
        closedDate: universalFields.closedDate,
      },
    });

    console.log("[SAVE CREDIT REPORT] Credit report created:", creditReport.id);

    return NextResponse.json({
      item: {
        id: creditReport.id,
        filename: creditReport.filename,
        sourceType: creditReport.sourceType,
        uploadedAt: creditReport.uploadedAt,
        reportFingerprint: creditReport.reportFingerprint,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save credit report";
    console.error("[SAVE CREDIT REPORT] Error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
