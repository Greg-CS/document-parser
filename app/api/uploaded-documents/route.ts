import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

function safeJsonParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export async function GET() {
  const docs = await prisma.uploadedDocument.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 50,
    include: { reports: { select: { id: true, createdAt: true, sourceType: true } } },
  });

  return NextResponse.json({
    items: docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      uploadedAt: d.uploadedAt,
      sourceType: d.sourceType,
      parsedData: d.parsedData,
      reports: d.reports,
    })),
  });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const sourceType = String(form.get("sourceType") ?? "ManualUpload");
    const kind = String(form.get("kind") ?? "unknown");

    const parsedDataFromClient = safeJsonParse(form.get("parsedData")?.toString() ?? null);

    const rawBytes = Buffer.from(await file.arrayBuffer());

    const isText =
      file.type.startsWith("text/") ||
      kind === "json" ||
      kind === "csv" ||
      kind === "html";

    const rawText = isText ? await file.text() : null;

    const parsedData = parsedDataFromClient ?? {
      kind,
      note: "No parsedData provided; stored raw content.",
    };

    const parsedDataJson = parsedData as Prisma.InputJsonValue;

    const uploaded = await prisma.uploadedDocument.create({
      data: {
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        sourceType,
        rawText,
        rawBytes,
        parsedData: parsedDataJson,
        reports: {
          create: {
            sourceType,
            rawPayload: parsedDataJson,
          },
        },
      },
      include: { reports: { select: { id: true, createdAt: true, sourceType: true } } },
    });

    return NextResponse.json({
      item: {
        id: uploaded.id,
        filename: uploaded.filename,
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSize,
        uploadedAt: uploaded.uploadedAt,
        sourceType: uploaded.sourceType,
        parsedData: uploaded.parsedData,
        reports: uploaded.reports,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to upload document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
