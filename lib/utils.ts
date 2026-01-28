import { FileJson, FileSpreadsheet, FileText, FileType } from "lucide-react"

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import type { HtmlParsed, SupportedKind } from "@/lib/types/import-dashboard.types"
import { CreditComment, FIELD_DEFINITIONS } from "./types/Global"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-"
  const units = ["B", "KB", "MB", "GB"] as const
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function extractNestedKeys(
  value: unknown,
  prefix = "",
  maxDepth = 4,
  options?: {
    arraySampleSize?: number
    maxKeys?: number
  }
): string[] {
  const arraySampleSize = options?.arraySampleSize ?? 10
  const maxKeys = options?.maxKeys ?? 5000
  const keys = new Set<string>()

  const isPrimitive = (v: unknown) =>
    v === null ||
    v === undefined ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"

  const addKey = (k: string) => {
    if (!k) return
    if (keys.size >= maxKeys) return
    keys.add(k)
  }

  const visit = (node: unknown, path: string, depth: number) => {
    if (keys.size >= maxKeys) return
    if (depth > maxDepth) return

    if (isPrimitive(node)) {
      addKey(path || "value")
      return
    }

    if (Array.isArray(node)) {
      const arrayPath = path ? `${path}[*]` : "[*]"

      if (node.length === 0) {
        addKey(arrayPath)
        return
      }

      const sample = node.slice(0, arraySampleSize)
      for (const item of sample) {
        if (keys.size >= maxKeys) return
        if (isPrimitive(item)) {
          addKey(arrayPath)
        } else {
          visit(item, arrayPath, depth)
        }
      }

      return
    }

    if (isRecord(node)) {
      for (const [k, v] of Object.entries(node)) {
        if (keys.size >= maxKeys) return
        const fullPath = path ? `${path}.${k}` : k

        if (isPrimitive(v)) {
          addKey(fullPath)
        } else if (isRecord(v) || Array.isArray(v)) {
          visit(v, fullPath, depth + 1)
        }
      }
    }
  }

  visit(value, prefix, 0)
  return Array.from(keys).sort()
}

export function stringifyPrimitive(value: unknown) {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

export function shortKey(label: string) {
  const lastDot = label.lastIndexOf(".")
  if (lastDot === -1) return label
  const trimmed = label.slice(lastDot + 1)
  return trimmed || label
}

// Normalize field name for display - removes @ and @_ prefixes and formats as readable text
export function normalizeFieldName(key: string): string {
  // Get the last segment after the last dot
  const lastDot = key.lastIndexOf(".")
  let fieldName = lastDot === -1 ? key : key.slice(lastDot + 1)
  
  // Remove @ and @_ prefixes
  fieldName = fieldName.replace(/^@_?/, '')
  
  // Remove array notation like [*] or [0]
  fieldName = fieldName.replace(/\[\*?\d*\]/g, '')
  
  // Convert camelCase/PascalCase to spaced words
  fieldName = fieldName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  
  // Capitalize first letter
  return fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
}

export function jsonToLabels(value: unknown, limit = 12) {
  const items: Array<{ label: string; value: string }> = []

  const visit = (node: unknown, path: string, depth: number) => {
    if (items.length >= limit) return
    if (depth > 3) return

    if (
      node === null ||
      typeof node === "string" ||
      typeof node === "number" ||
      typeof node === "boolean" ||
      node === undefined
    ) {
      items.push({ label: path || "value", value: stringifyPrimitive(node) })
      return
    }

    if (Array.isArray(node)) {
      items.push({
        label: path || "array",
        value: `${node.length} item${node.length === 1 ? "" : "s"}`,
      })
      if (node.length > 0) visit(node[0], path ? `${path}[0]` : "[0]", depth + 1)
      return
    }

    if (isRecord(node)) {
      const entries = Object.entries(node)
      if (!path) {
        items.push({ label: "keys", value: String(entries.length) })
      }
      for (const [k, v] of entries) {
        if (items.length >= limit) return
        const nextPath = path ? `${path}.${k}` : k
        if (
          v === null ||
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean" ||
          v === undefined
        ) {
          items.push({ label: nextPath, value: stringifyPrimitive(v) })
        } else {
          visit(v, nextPath, depth + 1)
        }
      }
    }
  }

  visit(value, "", 0)
  return items
}

export function jsonToTable(
  value: unknown
): { columns: string[]; rows: Array<Record<string, string>> } | null {
  if (!Array.isArray(value)) return null
  if (value.length === 0) return { columns: [], rows: [] }

  const objects = value.filter(isRecord)
  if (objects.length === 0) return null

  const columnSet = new Set<string>()
  for (const obj of objects.slice(0, 25)) {
    for (const k of Object.keys(obj)) columnSet.add(k)
  }
  const columns = Array.from(columnSet)

  const rows = objects.slice(0, 50).map((obj) => {
    const row: Record<string, string> = {}
    for (const c of columns) row[c] = stringifyPrimitive(obj[c])
    return row
  })

  return { columns, rows }
}

export function parseHtmlToFields(raw: string): HtmlParsed {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, "text/html")

  const title = (doc.querySelector("title")?.textContent ?? "").trim()
  const metaDescription = (
    doc
      .querySelector('meta[name="description"], meta[property="og:description"]')
      ?.getAttribute("content") ?? ""
  ).trim()

  const headings: HtmlParsed["headings"] = []
    ; (doc.querySelectorAll("h1, h2, h3") as NodeListOf<HTMLElement>).forEach((el) => {
      const tag = el.tagName.toLowerCase()
      if (tag !== "h1" && tag !== "h2" && tag !== "h3") return
      const text = (el.textContent ?? "").trim()
      if (!text) return
      headings.push({ level: tag, text })
    })

  const links: HtmlParsed["links"] = []
    ; (doc.querySelectorAll("a[href]") as NodeListOf<HTMLAnchorElement>).forEach((a) => {
      const href = (a.getAttribute("href") ?? "").trim()
      if (!href) return
      const text = (a.textContent ?? "").trim()
      links.push({ text, href })
    })

  const images = doc.querySelectorAll("img").length
  const textPreview = (doc.body?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280)

  return {
    title,
    metaDescription,
    headings,
    links,
    images,
    textPreview,
    raw,
  }
}

export function htmlToLabels(parsed: HtmlParsed) {
  const h1Count = parsed.headings.filter((h) => h.level === "h1").length
  const h2Count = parsed.headings.filter((h) => h.level === "h2").length
  const h3Count = parsed.headings.filter((h) => h.level === "h3").length

  const labels: Array<{ label: string; value: string }> = [
    { label: "Title", value: parsed.title || "—" },
    { label: "Meta description", value: parsed.metaDescription || "—" },
    {
      label: "Headings",
      value: `${parsed.headings.length} (h1:${h1Count}, h2:${h2Count}, h3:${h3Count})`,
    },
    { label: "Links", value: String(parsed.links.length) },
    { label: "Images", value: String(parsed.images) },
  ]

  if (parsed.textPreview) labels.push({ label: "Text preview", value: parsed.textPreview })
  return labels
}

export function htmlToTable(parsed: HtmlParsed) {
  const headingRows = parsed.headings.slice(0, 25).map((h) => ({
    type: h.level,
    text: h.text,
    href: "",
  }))
  const linkRows = parsed.links.slice(0, 25).map((l) => ({
    type: "link",
    text: l.text || "(no text)",
    href: l.href,
  }))
  return {
    columns: ["type", "text", "href"],
    rows: [...headingRows, ...linkRows],
  }
}

export function detectKind(file: File): SupportedKind | null {
  const name = file.name.toLowerCase()
  if (name.endsWith(".json")) return "json"
  if (name.endsWith(".csv")) return "csv"
  if (name.endsWith(".html") || name.endsWith(".htm")) return "html"
  if (name.endsWith(".pdf")) return "pdf"
  return null
}

export function kindLabel(kind: SupportedKind) {
  switch (kind) {
    case "json":
      return "JSON"
    case "csv":
      return "CSV"
    case "html":
      return "HTML"
    case "pdf":
      return "PDF"
  }
}

export function kindIcon(kind: SupportedKind) {
  switch (kind) {
    case "json":
      return FileJson
    case "csv":
      return FileSpreadsheet
    case "html":
      return FileText
    case "pdf":
      return FileType
  }
}

export async function ingestUploadedDocument(uploadedDocumentId: string) {
  const res = await fetch("/api/reports/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      uploadedDocumentId,
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to ingest report (${res.status})`)
  }

  return res
}

export function getFieldDefinition(fieldName: string): string | null {
  const normalized = fieldName.replace(/^@_?/, "").replace(/_/g, "");
  for (const [key, def] of Object.entries(FIELD_DEFINITIONS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      return def;
    }
  }
  return null;
}


export function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.replace(/\[\*\]/g, ".0").replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function normalizeTextDisplay(value: string): string {
  const withoutAt = value.replace(/^@_?/, "");
  const withSpaces = withoutAt
    .replace(/_/g, " ")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return withSpaces.toLowerCase();
}

export function formatDisplayValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "object") {
    if (Array.isArray(value)) return `[${value.length} items]`;
    return "{...}";
  }
  const stringValue = stringifyPrimitive(value);
  return typeof value === "string" ? normalizeTextDisplay(stringValue) : stringValue;
}

export function hasDerogatoryIndicator(data: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("derogatorydata") || lowerKey.includes("derogatory_data")) {
      const value = getValueAtPath(data, key);
      if (value === true || value === "Y" || value === "Yes" || value === "1" || value === 1) {
        return true;
      }
    }
  }
  return false;
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return "[unserializable]"
  }
}

export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[@_\-\s]/g, "");
}

export function getNestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const part of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Helper to get field value with fallback keys
export function getRawField(fields: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const keyParts = key.split(".").filter(Boolean);
    if (keyParts.length > 1) {
      const nestedValue = getNestedValue(fields, keyParts);
      if (nestedValue !== undefined && nestedValue !== null) return nestedValue;
      continue;
    }

    const normalizedSearch = normalizeKey(key);
    for (const [fieldKey, value] of Object.entries(fields)) {
      if (normalizeKey(fieldKey) === normalizedSearch && value !== undefined && value !== null) {
        return value;
      }
    }
  }
  return undefined;
}

export function getField(fields: Record<string, unknown>, ...keys: string[]): string {
  const raw = getRawField(fields, ...keys);
  if (raw === undefined || raw === null) return "—";
  return formatDisplayValue(raw);
}

 export function formatDateValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoDateMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoDateMatch) return isoDateMatch[0];
    return trimmed;
  }
  return formatDisplayValue(value);
}

export function formatMoneyValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return formatDisplayValue(value);
  if (num >= 999_999_000) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

export function getCreditComments(fields: Record<string, unknown>): CreditComment[] {
  const raw = getRawField(fields, "CREDIT_COMMENT", "creditcomment", "credit_comment", "_CREDIT_COMMENT", "_CREDITCOMMENTS");
  const out: CreditComment[] = [];

  const visit = (value: unknown, depth: number) => {
    if (!value || depth > 4) return;

    if (Array.isArray(value)) {
      for (const v of value) visit(v, depth + 1);
      return;
    }

    if (typeof value !== "object") return;
    const rec = value as Record<string, unknown>;

    const codeRaw = getRawField(rec, "@_Code", "@Code", "code", "_Code");
    const textRaw = getRawField(rec, "_Text", "text", "@_Text", "@Text", "_text");
    const code = typeof codeRaw === "string" ? codeRaw.trim() : String(codeRaw ?? "").trim();
    const text = typeof textRaw === "string" ? textRaw.trim() : String(textRaw ?? "").trim();
    if (code || text) out.push({ code: code || undefined, text: text || undefined });

    const nested =
      rec["CREDIT_COMMENT"] ??
      rec["credit_comment"] ??
      rec["creditComment"] ??
      rec["_CREDIT_COMMENT"] ??
      rec["_CREDITCOMMENTS"];
    if (nested) visit(nested, depth + 1);
  };

  visit(raw, 0);
  return out;
}

export function extractTrendedDataText(comments: CreditComment[]): string | null {
  for (const c of comments) {
    const txt = (c.text ?? "").trim();
    if (!txt) continue;
    if (!/trendeddata/i.test(txt)) continue;

    const section = txt.match(/<\s*TrendedData[\s\S]*?<\s*\/\s*TrendedData\s*>/i)?.[0];
    return section ?? txt;
  }
  return null;
}

function monthKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonths(date: Date, deltaMonths: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + deltaMonths, 1);
}

function parseStartMonth(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
  return new Date(year, monthIndex, 1);
}

function paymentCodeLabel(code: string): { label: string; tone: "ok" | "late" | "bad" | "unknown" } {
  const c = code.toUpperCase();
  if (c === "8") return { label: "Current", tone: "ok" };
  if (c === "9") return { label: "Unknown", tone: "unknown" };
  if (c === "0") return { label: "Too New", tone: "unknown" };
  if (c === "1") return { label: "30D Late", tone: "late" };
  if (c === "2") return { label: "60D Late", tone: "late" };
  if (c === "3") return { label: "90D Late", tone: "bad" };
  if (c === "4") return { label: "120D Late", tone: "bad" };
  if (c === "5") return { label: "150D Late", tone: "bad" };
  if (c === "6") return { label: "180D Late", tone: "bad" };
  if (c === "7") return { label: "210+D Late", tone: "bad" };
  if (c === "C") return { label: "Closed", tone: "unknown" };
  if (c === "X") return { label: "No Data", tone: "unknown" };
  return { label: `Code ${code}`, tone: "unknown" };
}

export function getPaymentHistoryTimeline(fields: Record<string, unknown>) {
  const start = parseStartMonth(getRawField(fields, "_PAYMENT_PATTERN.@_StartDate", "paymentpatternstartdate"));
  const dataRaw = getRawField(fields, "_PAYMENT_PATTERN.@_Data", "paymentpattern", "paymentpatterndata");
  const data = typeof dataRaw === "string" ? dataRaw.trim() : String(dataRaw ?? "").trim();

  if (!start || !data) return [];

  const out: Array<{ month: string; code: string; label: string; tone: "ok" | "late" | "bad" | "unknown" }> = [];
  for (let i = 0; i < data.length; i++) {
    const code = data[i];
    const month = monthKeyFromDate(addMonths(start, -i));
    const { label, tone } = paymentCodeLabel(code);
    out.push({ month, code, label, tone });
  }
  return out;
}

export function paymentGridCell(code: string, tone: "ok" | "late" | "bad" | "unknown") {
  const base = "rounded px-1 py-0.5 font-semibold";
  if (tone === "ok") return { text: code, className: cn(base, "bg-green-100 text-green-800") };
  if (tone === "late") return { text: code, className: cn(base, "bg-amber-100 text-amber-800") };
  if (tone === "bad") return { text: code, className: cn(base, "bg-red-100 text-red-800") };
  return { text: code, className: cn(base, "bg-stone-100 text-stone-700") };
}