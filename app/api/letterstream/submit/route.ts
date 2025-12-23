import { NextResponse } from "next/server";
import { createLetterStreamAuth } from "@/lib/letterstreamAuth";

export const runtime = "nodejs";

function toPdfSafeAscii(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function escapePdfString(input: string) {
  return input.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makeOnePagePdfBytes(text: string): Uint8Array {
  const safe = toPdfSafeAscii(text);
  const lines = safe.split("\n").slice(0, 80);

  const contentLines: string[] = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
  ];

  let first = true;
  for (const line of lines) {
    if (!first) contentLines.push("0 -14 Td");
    first = false;
    contentLines.push(`(${escapePdfString(line)}) Tj`);
  }
  contentLines.push("ET");
  const contentStream = contentLines.join("\n") + "\n";

  const encoder = new TextEncoder();
  const parts: string[] = [];
  const offsets: number[] = [];
  let cursor = 0;

  const push = (s: string) => {
    parts.push(s);
    cursor += encoder.encode(s).byteLength;
  };

  push("%PDF-1.4\n");

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
  );
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const contentLength = encoder.encode(contentStream).byteLength;
  objects.push(
    `5 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}endstream\nendobj\n`
  );

  for (const obj of objects) {
    offsets.push(cursor);
    push(obj);
  }

  const xrefStart = cursor;
  push("xref\n");
  push("0 6\n");
  push("0000000000 65535 f \n");
  for (const off of offsets) {
    const line = `${String(off).padStart(10, "0")} 00000 n \n`;
    push(line);
  }

  push("trailer\n");
  push("<< /Size 6 /Root 1 0 R >>\n");
  push("startxref\n");
  push(`${xrefStart}\n`);
  push("%%EOF\n");

  return encoder.encode(parts.join(""));
}

export async function POST(req: Request) {
  const formData = await req.formData();

  const apiId = process.env.LETTERSTREAM_API_ID;
  const apiKey = process.env.LETTERSTREAM_API_KEY;
  const baseUrl = process.env.LETTERSTREAM_BASE_URL;

  if (!apiId || !apiKey || !baseUrl) {
    return NextResponse.json(
      { error: "Missing LetterStream env vars (LETTERSTREAM_API_ID, LETTERSTREAM_API_KEY, LETTERSTREAM_BASE_URL)" },
      { status: 500 }
    );
  }

  const { h, t } = createLetterStreamAuth(apiKey);

  // Required fields
  const job = `job_${t}`;
  const pages = formData.get("pages") ?? "1";
  const from = formData.get("from");
  const to = formData.getAll("to[]");
  const file = formData.get("file");
  const letterText = formData.get("letterText");

  if (!from || to.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hasUpload = file instanceof File;
  const hasLetterText = typeof letterText === "string" && letterText.trim().length > 0;

  if (!hasUpload && !hasLetterText) {
    return NextResponse.json({ error: "Missing required fields (file or letterText)" }, { status: 400 });
  }

  for (const recipient of to) {
    const raw = recipient.toString();
    const parts = raw.split(/[|:]/g);
    if (parts.length !== 8) {
      return NextResponse.json(
        {
          error:
            "Invalid recipient format. Each to[] must contain 8 fields delimited by | or : in the order: name1|name2|address1|address2|address3|city|state|zip",
          received: raw,
        },
        { status: 400 }
      );
    }
  }

  const singleFile: Blob = hasUpload
    ? (file as File)
    : new Blob([Buffer.from(makeOnePagePdfBytes(letterText as string))], { type: "application/pdf" });

  const effectivePages = hasUpload ? pages.toString() : "1";

  const lsForm = new FormData();
  lsForm.append("a", apiId);
  lsForm.append("h", h);
  lsForm.append("t", t);
  lsForm.append("job", job);
  lsForm.append("pages", effectivePages);
  lsForm.append("from", from.toString());

  to.forEach((recipient) => {
    lsForm.append("to[]", recipient.toString());
  });

  lsForm.append("single_file", singleFile, "letter.pdf");

  // Optional defaults
  lsForm.append("mailtype", "firstclass");
  lsForm.append("coversheet", "Y");
  lsForm.append("debug", "3");

  const response = await fetch(baseUrl, {
    method: "POST",
    body: lsForm,
  });

  const text = await response.text();

  return new NextResponse(text, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "text/xml",
    },
  });
}
