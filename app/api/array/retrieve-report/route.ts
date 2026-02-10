import { NextRequest, NextResponse } from "next/server";

const SANDBOX_BASE = "https://sandbox.array.io";
const MAX_POLL_ATTEMPTS = 10;
const POLL_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  const reportKey = req.nextUrl.searchParams.get("reportKey");
  const displayToken = req.nextUrl.searchParams.get("displayToken");

  if (!reportKey || !displayToken) {
    return NextResponse.json(
      { error: "reportKey and displayToken are required" },
      { status: 400 }
    );
  }

  try {
    const url = `${SANDBOX_BASE}/api/report/v2/html?reportKey=${reportKey}&displayToken=${displayToken}`;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const res = await fetch(url);

      if (res.status === 200) {
        const html = await res.text();
        return new NextResponse(html, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (res.status === 204) {
        console.error("Array report generation failed (204)");
        return NextResponse.json(
          { error: "Report generation failed (204)" },
          { status: 502 }
        );
      }

      // 202 = still generating, retry after delay
      if (res.status === 202) {
        console.log(`Report not ready yet (attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS}), retrying...`);
        await sleep(POLL_DELAY_MS);
        continue;
      }

      // Unexpected status
      const text = await res.text();
      console.error(`Array retrieve-report unexpected status (${res.status}):`, text);
      return NextResponse.json(
        { error: `Unexpected status ${res.status}`, detail: text },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Report generation timed out after polling" },
      { status: 504 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to retrieve report:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
