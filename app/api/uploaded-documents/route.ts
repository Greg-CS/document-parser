import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

function getS3Client() {
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error("AWS_REGION not configured");
  }

  return new S3Client({ region });
}

function getS3Config() {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error("S3_BUCKET_NAME not configured");
  }

  const prefixRaw = process.env.S3_PREFIX ?? "";
  const prefix = prefixRaw && !prefixRaw.endsWith("/") ? `${prefixRaw}/` : prefixRaw;

  return { bucket, prefix };
}

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
    const sha256 = createHash("sha256").update(rawBytes).digest("hex");

    const existing = await prisma.uploadedDocument.findFirst({
      where: { sha256 },
      include: { reports: { select: { id: true, createdAt: true, sourceType: true } } },
    });

    if (existing) {
      return NextResponse.json({
        item: {
          id: existing.id,
          filename: existing.filename,
          mimeType: existing.mimeType,
          fileSize: existing.fileSize,
          uploadedAt: existing.uploadedAt,
          sourceType: existing.sourceType,
          parsedData: existing.parsedData,
          reports: existing.reports,
        },
      });
    }

    const isText =
      file.type.startsWith("text/") ||
      kind === "json" ||
      kind === "csv" ||
      kind === "html";

    const rawText = isText ? rawBytes.toString("utf8") : null;

    const parsedData = parsedDataFromClient ?? {
      kind,
      note: "No parsedData provided; stored raw content.",
    };

    const parsedDataJson = parsedData as Prisma.InputJsonValue;

    const { bucket, prefix } = getS3Config();
    const client = getS3Client();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `${prefix}${sha256}/${safeName}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: rawBytes,
        ContentType: file.type || "application/octet-stream",
      })
    );

    const uploaded = await prisma.uploadedDocument.create({
      data: {
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        sourceType,
        rawText,
        rawBytes: null,
        parsedData: parsedDataJson,
        sha256,
        storageProvider: "s3",
        s3Bucket: bucket,
        s3ObjectKey: objectKey,
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
