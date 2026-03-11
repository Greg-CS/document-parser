import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

/**
 * POST /api/auth/login
 * Login or register user with Array credentials
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { arrayUserId, arrayApiKey, email } = body;

    console.log("[AUTH LOGIN] Request received:", { arrayUserId, email: email || "not provided" });

    if (!arrayUserId || !arrayApiKey) {
      console.error("[AUTH LOGIN] Missing credentials");
      return NextResponse.json(
        { error: "arrayUserId and arrayApiKey are required" },
        { status: 400 }
      );
    }

    // Find existing user by arrayUserId or create new one
    let user = await prisma.user.findFirst({
      where: { arrayUserId },
    });

    if (user) {
      console.log("[AUTH LOGIN] Found existing user:", user.id);
      // Update existing user's credentials
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          arrayApiKey,
          email: email || user.email,
        },
      });
      console.log("[AUTH LOGIN] Updated user:", user.id);
    } else {
      console.log("[AUTH LOGIN] Creating new user");
      // Create new user
      user = await prisma.user.create({
        data: {
          email: email || `${arrayUserId}@array.user`,
          arrayUserId,
          arrayApiKey,
        },
      });
      console.log("[AUTH LOGIN] Created new user:", user.id);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        arrayUserId: user.arrayUserId,
        arrayApiKey: user.arrayApiKey,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    console.error("[AUTH LOGIN] Error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
