import { NextResponse } from "next/server";

const SANDBOX_BASE = "https://sandbox.array.io";
const APP_KEY = "3F03D20E-5311-43D8-8A76-E4B5D77793BD";

export async function POST(req: Request) {
  try {
    const { userId, authToken, answers, authPin } = await req.json();

    if (!userId || !authToken || !answers) {
      return NextResponse.json(
        { error: "userId, authToken, and answers are required" },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      appKey: APP_KEY,
      userId,
      authToken,
      answers,
    };
    // OTP flow: include authPin (empty string for delivery selection, passcode for submission)
    if (typeof authPin === "string") {
      payload.authPin = authPin;
    }

    const res = await fetch(SANDBOX_BASE + "/api/authenticate/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    // 206 = more questions (OTP passcode prompt, or additional KBA round)
    if (res.status === 206) {
      const data = await res.json();
      return NextResponse.json({
        status: 206,
        authMethod: data.authMethod,
        authToken: data.authToken,
        provider: data.provider,
        questions: data.questions,
      });
    }

    // 202 = SMFA waiting for customer to click link
    if (res.status === 202) {
      return NextResponse.json({ status: 202, message: "Waiting for SMFA link click" });
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("Array verify-answers error (" + res.status + "):", text);
      return NextResponse.json(
        { error: "Array API returned " + res.status, detail: text },
        { status: 502 }
      );
    }

    // 200 = success, userToken returned
    const data = await res.json();
    return NextResponse.json({ status: 200, userToken: data.userToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to verify answers:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
