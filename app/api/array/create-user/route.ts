import { NextResponse } from "next/server";

const SANDBOX_BASE = "https://sandbox.array.io";
const APP_KEY = "3F03D20E-5311-43D8-8A76-E4B5D77793BD";

// Thomas Devos — Array sandbox test identity
const SANDBOX_USER = {
  appKey: APP_KEY,
  firstName: "THOMAS",
  lastName: "DEVOS",
  dob: "1957-09-06",
  ssn: "666023511",
  phoneNumber: "4045049006",
  emailAddress: "tdevos@example.com",
  address: {
    street: "1206 BEAR CREEK RD APT 110",
    city: "TUSCALOOSA",
    state: "AL",
    zip: "35405",
  },
};

export async function POST() {
  try {
    const res = await fetch(`${SANDBOX_BASE}/api/user/v2`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(SANDBOX_USER),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Array create-user error (${res.status}):`, text);
      return NextResponse.json(
        { error: `Array API returned ${res.status}`, detail: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ userId: data.userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to create Array user:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
