import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

// GET - Fetch all saved Array dev responses
export async function GET() {
  try {
    const docs = await prisma.uploadedDocument.findMany({
      where: { sourceType: "ArrayDevTest" },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        filename: true,
        uploadedAt: true,
        parsedData: true,
      },
    });

    return NextResponse.json({ items: docs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch saved responses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Save current Array response with custom label
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { label, data } = body;

    if (!label || typeof label !== "string") {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Data is required" }, { status: 400 });
    }

    const parsedDataJson = data as Prisma.InputJsonValue;

    const uploaded = await prisma.uploadedDocument.create({
      data: {
        filename: label,
        mimeType: "application/json",
        fileSize: JSON.stringify(data).length,
        sourceType: "ArrayDevTest",
        rawText: null,
        rawBytes: null,
        parsedData: parsedDataJson,
        sha256: null,
        storageProvider: "db",
        s3Bucket: null,
        s3ObjectKey: null,
        reportFingerprint: null,
      },
    });

    return NextResponse.json({
      item: {
        id: uploaded.id,
        filename: uploaded.filename,
        uploadedAt: uploaded.uploadedAt,
        parsedData: uploaded.parsedData,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save response";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Remove a saved response by ID
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.uploadedDocument.delete({
      where: { id, sourceType: "ArrayDevTest" },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete response";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
