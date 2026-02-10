import { NextRequest, NextResponse } from "next/server";

const SANDBOX_BASE = "https://sandbox.array.io";
const APP_KEY = "3F03D20E-5311-43D8-8A76-E4B5D77793BD";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  // Allow caller to choose providers; defaults to all three for Thomas Devos
  const provider1 = req.nextUrl.searchParams.get("provider1") || "tui";
  const provider2 = req.nextUrl.searchParams.get("provider2") || "efx";
  const provider3 = req.nextUrl.searchParams.get("provider3") || "exp";

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    let url = SANDBOX_BASE + "/api/authenticate/v2?appKey=" + APP_KEY + "&userId=" + userId;
    url += "&provider1=" + provider1;
    if (provider2) url += "&provider2=" + provider2;
    if (provider3) url += "&provider3=" + provider3;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error(`Array verify-questions error (${res.status}):`, text);
      return NextResponse.json(
        { error: `Array API returned ${res.status}`, detail: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      authMethod: data.authMethod,
      authToken: data.authToken,
      provider: data.provider,
      questions: data.questions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to fetch verification questions:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
