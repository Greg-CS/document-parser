import { NextResponse } from "next/server";

export const runtime = "nodejs";

const N8N_WEBHOOK_URL =
  "https://n8n.gregorrodriguez.com/webhook-test/43a9709e-49be-4f4f-aa18-ee6ad96e2da7";

function withCors(res: NextResponse) {
  res.headers.set("access-control-allow-origin", "*");
  res.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  res.headers.set("access-control-allow-headers", "content-type,authorization");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  return withCors(NextResponse.json({ ok: true }));
}

export async function POST(req: Request) {
  try {
    const incomingUrl = new URL(req.url);
    const targetUrl = new URL(N8N_WEBHOOK_URL);
    incomingUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });

    const contentType = req.headers.get("content-type") ?? "";

    const headers: Record<string, string> = {};
    if (contentType) headers["content-type"] = contentType;

    const body = contentType.includes("application/json")
      ? JSON.stringify(await req.json())
      : await req.text();

    const upstream = await fetch(targetUrl.toString(), {
      method: "POST",
      headers,
      body,
    });

    const upstreamContentType = upstream.headers.get("content-type") ?? "";
    const upstreamBody = await upstream.text();

    const res = new NextResponse(upstreamBody, {
      status: upstream.status,
      headers: {
        "content-type": upstreamContentType || "text/plain; charset=utf-8",
      },
    });

    return withCors(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook proxy failed";
    return withCors(NextResponse.json({ error: message }, { status: 500 }));
  }
}
