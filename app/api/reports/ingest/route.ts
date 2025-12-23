// app/api/reports/ingest/route.ts
import { Prisma } from "@prisma/client";

import { canonicalize } from "@/lib/canonicalize";

import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { uploadedDocumentId } = await req.json();

    if (!uploadedDocumentId) {
      return Response.json({ error: "Missing uploadedDocumentId" }, { status: 400 });
    }

    const document = await prisma.uploadedDocument.findUnique({
      where: { id: uploadedDocumentId },
    });

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const mappings = await prisma.fieldMapping.findMany({
      where: { sourceType: document.sourceType },
      include: { canonicalField: true },
    });

    const mappingsWithCanonical = mappings.filter(
      (m): m is typeof m & { canonicalField: NonNullable<typeof m.canonicalField> } =>
        m.canonicalField !== null
    );

    if (mappingsWithCanonical.length === 0) {
      return Response.json(
        { error: "No mappings defined for sourceType" },
        { status: 422 }
      );
    }

    const canonicalData = canonicalize({
      parsedData: document.parsedData,
      mappings: mappingsWithCanonical,
    });

    const allowedFields = [
      "firstName",
      "lastName",
      "ssnLast4",
      "dateOfBirth",
      "accountNumber",
      "accountType",
      "accountStatus",
      "balance",
      "openedDate",
      "closedDate",
    ] as const;

    const canonicalDataForReport: Record<string, unknown> = {};
    for (const k of allowedFields) {
      if (k in canonicalData) canonicalDataForReport[k] = canonicalData[k];
    }

    const report = await prisma.report.create({
      data: {
        sourceType: document.sourceType,
        sourceDocId: document.id,
        uploadedDocumentId: document.id,
        rawPayload: document.parsedData as unknown as Prisma.InputJsonValue,
        ...(canonicalDataForReport as Record<string, unknown>),
      },
    });

    return Response.json({ reportId: report.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to ingest report";
    return Response.json({ error: message }, { status: 500 });
  }
}
