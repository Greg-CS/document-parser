import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

/**
 * GET /api/disputes/rounds/[id]
 * Get a single dispute round by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const round = await prisma.disputeRound.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true },
        },
        creditReport: {
          select: { id: true, filename: true, sourceType: true, reportFingerprint: true },
        },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Dispute round not found" }, { status: 404 });
    }

    return NextResponse.json({ round });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch dispute round";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/disputes/rounds/[id]
 * Update a dispute round
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const {
      status,
      selectedItemIds,
      disputeReasons,
      letterGenerated,
      letterContent,
      bureausTargeted,
      itemCount,
      completedAt,
      sentAt,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) updateData.status = status;
    if (selectedItemIds !== undefined) updateData.selectedItemIds = selectedItemIds;
    if (disputeReasons !== undefined) updateData.disputeReasons = disputeReasons;
    if (letterGenerated !== undefined) updateData.letterGenerated = letterGenerated;
    if (letterContent !== undefined) updateData.letterContent = letterContent;
    if (bureausTargeted !== undefined) updateData.bureausTargeted = bureausTargeted;
    if (itemCount !== undefined) updateData.itemCount = itemCount;
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;
    if (sentAt !== undefined) updateData.sentAt = sentAt ? new Date(sentAt) : null;

    const round = await prisma.disputeRound.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, email: true },
        },
        creditReport: {
          select: { id: true, filename: true, sourceType: true },
        },
      },
    });

    return NextResponse.json({ round });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update dispute round";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/disputes/rounds/[id]
 * Delete a dispute round
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.disputeRound.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete dispute round";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
