import { NextResponse } from "next/server";

const SANDBOX_BASE = "https://sandbox.array.io";
// Server token from Array docs example — may only work in sandbox
const SERVER_TOKEN = "93061BA4-3DD3-43BB-8574-685B860FE894";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const res = await fetch(`${SANDBOX_BASE}/api/authenticate/v2`, {
      method: "PATCH",
      headers: {
        "x-array-server-token": SERVER_TOKEN,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        userId,
        authDetails: { dummyName: "dummyValue" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Array auto-verify error (" + res.status + "):", text);
      return NextResponse.json(
        { error: "Array API returned " + res.status, detail: text },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ userToken: data.userToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to auto-verify:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
