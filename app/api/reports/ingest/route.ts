// app/api/reports/ingest/route.ts
import { prisma } from "@/lib/prisma";
import { canonicalize } from "@/lib/canonicalize";

export async function POST(req: Request) {
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

    if (mappings.length === 0) {
        return Response.json(
            { error: "No mappings defined for sourceType" },
            { status: 422 }
        );
    }

    const canonicalData = canonicalize({
        parsedData: document.parsedData,
        mappings,
    });

    const report = await prisma.report.create({
        data: {
            sourceType: document.sourceType,
            sourceDocId: document.id,
            rawPayload: document.parsedData,
            ...canonicalData,
        },
    });

    return Response.json({ reportId: report.id });
}
