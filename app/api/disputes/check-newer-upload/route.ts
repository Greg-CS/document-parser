import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

/**
 * Checks if a newer upload with the same fingerprint exists for gating dispute rounds.
 * Query params:
 *   - documentId: current document ID
 *   - fingerprint: report fingerprint to match
 *   - userEmail: (optional) filter by user email
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    const fingerprint = searchParams.get("fingerprint");
    const userEmail = searchParams.get("userEmail");

    if (!documentId || !fingerprint) {
      return NextResponse.json(
        { error: "documentId and fingerprint are required" },
        { status: 400 }
      );
    }

    // Get the current document's upload date
    const currentDoc = await prisma.uploadedDocument.findUnique({
      where: { id: documentId },
      select: { uploadedAt: true, userId: true },
    });

    if (!currentDoc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Build query for newer documents with same fingerprint
    const whereClause: {
      reportFingerprint: string;
      uploadedAt: { gt: Date };
      userId?: string;
    } = {
      reportFingerprint: fingerprint,
      uploadedAt: { gt: currentDoc.uploadedAt },
    };

    // If userEmail provided, find user and filter by userId
    if (userEmail) {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true },
      });
      if (user) {
        whereClause.userId = user.id;
      }
    } else if (currentDoc.userId) {
      // Default to same user if document has userId
      whereClause.userId = currentDoc.userId;
    }

    const newerDoc = await prisma.uploadedDocument.findFirst({
      where: whereClause,
      orderBy: { uploadedAt: "asc" },
      select: {
        id: true,
        filename: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json({
      hasNewer: !!newerDoc,
      newerDocument: newerDoc || null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to check for newer uploads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
