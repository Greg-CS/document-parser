import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const fields = await prisma.canonicalField.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, dataType: true, description: true },
  });

  return NextResponse.json({ fields });
}
