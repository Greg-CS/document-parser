import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

/**
 * GET /api/disputes/rounds?creditReportId=xxx&userId=xxx
 * List all dispute rounds for a credit report
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const creditReportId = searchParams.get("creditReportId");
    const userId = searchParams.get("userId");

    if (!creditReportId) {
      return NextResponse.json(
        { error: "creditReportId is required" },
        { status: 400 }
      );
    }

    const whereClause: { creditReportId: string; userId?: string } = {
      creditReportId,
    };

    if (userId) {
      whereClause.userId = userId;
    }

    const rounds = await prisma.disputeRound.findMany({
      where: whereClause,
      orderBy: { roundNumber: "asc" },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    return NextResponse.json({ rounds });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch dispute rounds";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/disputes/rounds
 * Create a new dispute round
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      creditReportId,
      roundNumber,
      status = "suggested",
      selectedItemIds = [],
      disputeReasons = {},
      bureausTargeted = [],
      itemCount = 0,
    } = body;

    if (!userId || !creditReportId || roundNumber === undefined) {
      return NextResponse.json(
        { error: "userId, creditReportId, and roundNumber are required" },
        { status: 400 }
      );
    }

    // Check if round already exists
    const existing = await prisma.disputeRound.findUnique({
      where: {
        creditReportId_roundNumber: {
          creditReportId,
          roundNumber,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Dispute round already exists for this report and round number" },
        { status: 409 }
      );
    }

    const round = await prisma.disputeRound.create({
      data: {
        userId,
        creditReportId,
        roundNumber,
        status,
        selectedItemIds,
        disputeReasons,
        bureausTargeted,
        itemCount,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
        creditReport: {
          select: { id: true, filename: true, sourceType: true },
        },
      },
    });

    return NextResponse.json({ round }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create dispute round";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
