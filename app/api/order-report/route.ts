import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId, userToken } = await req.json();

  const res = await fetch(`${process.env.ARRAY_API_BASE}/api/report/v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-array-user-token": userToken,
    },
    body: JSON.stringify({
      userId,
      productCode: "exp1bReportScore",
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
