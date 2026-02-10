import { NextResponse } from "next/server";

const SANDBOX_BASE = "https://sandbox.array.io";

export async function POST(req: Request) {
  try {
    const { userId, userToken, productCode } = await req.json();

    if (!userId || !userToken) {
      return NextResponse.json(
        { error: "userId and userToken are required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${SANDBOX_BASE}/api/report/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-array-user-token": userToken,
      },
      body: JSON.stringify({
        userId,
        productCode: productCode ?? "exp1bReportScore",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Array order-report error (${res.status}):`, text);
      return NextResponse.json(
        { error: `Array API returned ${res.status}`, detail: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      reportKey: data.reportKey,
      displayToken: data.displayToken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to order report:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
