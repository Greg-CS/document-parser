import { NextResponse } from "next/server";

import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

export async function GET() {
  try {
    const fields = await prisma.canonicalField.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, dataType: true, description: true },
    });

    return NextResponse.json({ fields });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load canonical fields";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
