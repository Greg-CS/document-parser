"use client";

import * as React from "react";
import {
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  FileUp,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/atoms/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";

type SupportedKind = "json" | "csv" | "html" | "pdf";

type PreviewMode = "labels" | "raw" | "table";

type FileItem = {
  id: string;
  file: File;
  kind: SupportedKind;
  addedAt: number;
};

type JsonParseState =
  | {
      status: "idle";
      fileId: string | null;
    }
  | {
      status: "loading";
      fileId: string;
    }
  | {
      status: "error";
      fileId: string;
      message: string;
    }
  | {
      status: "success";
      fileId: string;
      value: unknown;
      pretty: string;
    };

type HtmlParsed = {
  title: string;
  metaDescription: string;
  headings: Array<{ level: "h1" | "h2" | "h3"; text: string }>;
  links: Array<{ text: string; href: string }>;
  images: number;
  textPreview: string;
  raw: string;
};

type HtmlParseState =
  | {
      status: "idle";
      fileId: string | null;
    }
  | {
      status: "loading";
      fileId: string;
    }
  | {
      status: "error";
      fileId: string;
      message: string;
    }
  | {
      status: "success";
      fileId: string;
      value: HtmlParsed;
    };

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyPrimitive(value: unknown) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function shortKey(label: string) {
  const lastDot = label.lastIndexOf(".");
  if (lastDot === -1) return label;
  const trimmed = label.slice(lastDot + 1);
  return trimmed || label;
}

function jsonToLabels(value: unknown, limit = 12) {
  const items: Array<{ label: string; value: string }> = [];

  const visit = (node: unknown, path: string, depth: number) => {
    if (items.length >= limit) return;
    if (depth > 3) return;

    if (
      node === null ||
      typeof node === "string" ||
      typeof node === "number" ||
      typeof node === "boolean" ||
      node === undefined
    ) {
      items.push({ label: path || "value", value: stringifyPrimitive(node) });
      return;
    }

    if (Array.isArray(node)) {
      items.push({
        label: path || "array",
        value: `${node.length} item${node.length === 1 ? "" : "s"}`,
      });
      if (node.length > 0) visit(node[0], path ? `${path}[0]` : "[0]", depth + 1);
      return;
    }

    if (isRecord(node)) {
      const entries = Object.entries(node);
      if (!path) {
        items.push({ label: "keys", value: String(entries.length) });
      }
      for (const [k, v] of entries) {
        if (items.length >= limit) return;
        const nextPath = path ? `${path}.${k}` : k;
        if (
          v === null ||
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean" ||
          v === undefined
        ) {
          items.push({ label: nextPath, value: stringifyPrimitive(v) });
        } else {
          visit(v, nextPath, depth + 1);
        }
      }
    }
  };

  visit(value, "", 0);
  return items;
}

function jsonToTable(value: unknown): { columns: string[]; rows: Array<Record<string, string>> } | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return { columns: [], rows: [] };

  const objects = value.filter(isRecord);
  if (objects.length === 0) return null;

  const columnSet = new Set<string>();
  for (const obj of objects.slice(0, 25)) {
    for (const k of Object.keys(obj)) columnSet.add(k);
  }
  const columns = Array.from(columnSet);

  const rows = objects.slice(0, 50).map((obj) => {
    const row: Record<string, string> = {};
    for (const c of columns) row[c] = stringifyPrimitive(obj[c]);
    return row;
  });

  return { columns, rows };
}

function parseHtmlToFields(raw: string): HtmlParsed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");

  const title = (doc.querySelector("title")?.textContent ?? "").trim();
  const metaDescription = (
    doc.querySelector('meta[name="description"], meta[property="og:description"]')?.getAttribute("content") ??
    ""
  ).trim();

  const headings: HtmlParsed["headings"] = [];
  (doc.querySelectorAll("h1, h2, h3") as NodeListOf<HTMLElement>).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag !== "h1" && tag !== "h2" && tag !== "h3") return;
    const text = (el.textContent ?? "").trim();
    if (!text) return;
    headings.push({ level: tag, text });
  });

  const links: HtmlParsed["links"] = [];
  (doc.querySelectorAll("a[href]") as NodeListOf<HTMLAnchorElement>).forEach((a) => {
    const href = (a.getAttribute("href") ?? "").trim();
    if (!href) return;
    const text = (a.textContent ?? "").trim();
    links.push({ text, href });
  });

  const images = doc.querySelectorAll("img").length;
  const textPreview = (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 280);

  return {
    title,
    metaDescription,
    headings,
    links,
    images,
    textPreview,
    raw,
  };
}

function htmlToLabels(parsed: HtmlParsed) {
  const h1Count = parsed.headings.filter((h) => h.level === "h1").length;
  const h2Count = parsed.headings.filter((h) => h.level === "h2").length;
  const h3Count = parsed.headings.filter((h) => h.level === "h3").length;

  const labels: Array<{ label: string; value: string }> = [
    { label: "Title", value: parsed.title || "—" },
    { label: "Meta description", value: parsed.metaDescription || "—" },
    { label: "Headings", value: `${parsed.headings.length} (h1:${h1Count}, h2:${h2Count}, h3:${h3Count})` },
    { label: "Links", value: String(parsed.links.length) },
    { label: "Images", value: String(parsed.images) },
  ];

  if (parsed.textPreview) labels.push({ label: "Text preview", value: parsed.textPreview });
  return labels;
}

function htmlToTable(parsed: HtmlParsed) {
  const headingRows = parsed.headings.slice(0, 25).map((h) => ({
    type: h.level,
    text: h.text,
    href: "",
  }));
  const linkRows = parsed.links.slice(0, 25).map((l) => ({
    type: "link",
    text: l.text || "(no text)",
    href: l.href,
  }));
  return {
    columns: ["type", "text", "href"],
    rows: [...headingRows, ...linkRows],
  };
}

function detectKind(file: File): SupportedKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (name.endsWith(".pdf")) return "pdf";
  return null;
}

function kindLabel(kind: SupportedKind) {
  switch (kind) {
    case "json":
      return "JSON";
    case "csv":
      return "CSV";
    case "html":
      return "HTML";
    case "pdf":
      return "PDF";
  }
}

function kindIcon(kind: SupportedKind) {
  switch (kind) {
    case "json":
      return FileJson;
    case "csv":
      return FileSpreadsheet;
    case "html":
      return FileText;
    case "pdf":
      return FileType;
  }
}

const MOCK_LABELS: Record<SupportedKind, Array<{ label: string; value: string }>> = {
  json: [
    { label: "Document Type", value: "Invoice" },
    { label: "Invoice #", value: "INV-1042" },
    { label: "Vendor", value: "Acme Supplies" },
    { label: "Total", value: "$1,248.40" },
  ],
  csv: [
    { label: "Rows", value: "128" },
    { label: "Columns", value: "7" },
    { label: "Primary Column", value: "customer_id" },
    { label: "Sample Range", value: "A1:G20" },
  ],
  html: [
    { label: "Title", value: "Quarterly Report" },
    { label: "Headings", value: "12" },
    { label: "Links", value: "37" },
    { label: "Images", value: "5" },
  ],
  pdf: [
    { label: "Pages", value: "—" },
    { label: "Detected Layout", value: "—" },
    { label: "Extraction", value: "Not implemented" },
    { label: "OCR", value: "Not implemented" },
  ],
};

const MOCK_RAW: Record<SupportedKind, string> = {
  json: `{
  "invoice": {
    "number": "INV-1042",
    "vendor": "Acme Supplies",
    "total": 1248.40,
    "currency": "USD"
  }
}`,
  csv: `customer_id,first_name,last_name,total_spend\n10231,Ada,Lovelace,120.50\n10232,Alan,Turing,75.00\n10233,Grace,Hopper,220.10`,
  html: `<!doctype html>\n<html>\n  <head><title>Quarterly Report</title></head>\n  <body>\n    <h1>Q3 Overview</h1>\n    <p>Revenue grew 12% ...</p>\n  </body>\n</html>`,
  pdf: `PDF preview is not available yet.\n\nLater this will show extracted text, structured fields, and/or page thumbnails.`,
};

const MOCK_TABLE: Record<SupportedKind, { columns: string[]; rows: Array<Record<string, string>> } | null> = {
  json: null,
  csv: {
    columns: ["customer_id", "first_name", "last_name", "total_spend"],
    rows: [
      {
        customer_id: "10231",
        first_name: "Ada",
        last_name: "Lovelace",
        total_spend: "120.50",
      },
      {
        customer_id: "10232",
        first_name: "Alan",
        last_name: "Turing",
        total_spend: "75.00",
      },
      {
        customer_id: "10233",
        first_name: "Grace",
        last_name: "Hopper",
        total_spend: "220.10",
      },
    ],
  },
  html: {
    columns: ["section", "value"],
    rows: [
      { section: "h1", value: "Q3 Overview" },
      { section: "p", value: "Revenue grew 12% ..." },
      { section: "h2", value: "Highlights" },
    ],
  },
  pdf: null,
};

function PreviewModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function KeyValueGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border bg-background px-4 py-3"
        >
          <div className="text-xs font-medium text-muted-foreground">
            {item.label}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaginatedKeyValueGrid({
  items,
  page,
  pageSize,
  showFullKeys,
  onPageChange,
  onPageSizeChange,
  onToggleShowFullKeys,
}: {
  items: Array<{ label: string; value: string }>;
  page: number;
  pageSize: number;
  showFullKeys: boolean;
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
  onToggleShowFullKeys: () => void;
}) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Showing {total === 0 ? 0 : start + 1}–{Math.min(start + pageSize, total)} of {total}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onToggleShowFullKeys}
          >
            {showFullKeys ? "Full keys" : "Short keys"}
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Per page</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {[6, 12, 24, 48].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
            >
              Prev
            </Button>
            <div className="text-xs text-muted-foreground">
              Page {safePage} / {totalPages}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {slice.map((item) => {
          const displayKey = showFullKeys ? item.label : shortKey(item.label);
          return (
            <div
              key={item.label}
              className="rounded-lg border bg-background px-4 py-3"
            >
              <div
                className="truncate text-xs font-medium text-muted-foreground"
                title={item.label}
              >
                {displayKey}
              </div>
              <div
                className="mt-1 truncate text-sm font-medium text-foreground"
                title={item.value}
              >
                {item.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Record<string, string>>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="border-b px-3 py-2 text-left font-medium text-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="odd:bg-muted/20">
                {columns.map((c) => (
                  <td key={c} className="border-b px-3 py-2 text-foreground">
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ImportDashboard() {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("labels");
  const [isDragging, setIsDragging] = React.useState(false);
  const [labelsPage, setLabelsPage] = React.useState(1);
  const [labelsPageSize, setLabelsPageSize] = React.useState(12);
  const [showFullKeys, setShowFullKeys] = React.useState(false);
  const [jsonParse, setJsonParse] = React.useState<JsonParseState>({
    status: "idle",
    fileId: null,
  });
  const [htmlParse, setHtmlParse] = React.useState<HtmlParseState>({
    status: "idle",
    fileId: null,
  });

  const selected = React.useMemo(
    () => files.find((f) => f.id === selectedId) ?? null,
    [files, selectedId]
  );

  const parseSelectedJson = React.useCallback(async () => {
    if (!selected || selected.kind !== "json") return;

    setJsonParse({ status: "loading", fileId: selected.id });

    try {
      const text = await selected.file.text();
      const value = JSON.parse(text) as unknown;
      const pretty = JSON.stringify(value, null, 2);
      setJsonParse({ status: "success", fileId: selected.id, value, pretty });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to parse JSON";
      setJsonParse({ status: "error", fileId: selected.id, message });
    }
  }, [selected]);

  const parseSelectedHtml = React.useCallback(async () => {
    if (!selected || selected.kind !== "html") return;

    setHtmlParse({ status: "loading", fileId: selected.id });

    try {
      const raw = await selected.file.text();
      const value = parseHtmlToFields(raw);
      setHtmlParse({ status: "success", fileId: selected.id, value });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to parse HTML";
      setHtmlParse({ status: "error", fileId: selected.id, message });
    }
  }, [selected]);

  const parseSelected = React.useCallback(async () => {
    if (!selected) return;
    if (selected.kind === "json") {
      await parseSelectedJson();
      return;
    }
    if (selected.kind === "html") {
      await parseSelectedHtml();
    }
  }, [parseSelectedHtml, parseSelectedJson, selected]);

  React.useEffect(() => {
    if (!selected) {
      setJsonParse({ status: "idle", fileId: null });
      setHtmlParse({ status: "idle", fileId: null });
      setLabelsPage(1);
      return;
    }
    if (selected.kind === "json") {
      if (jsonParse.fileId !== selected.id) {
        setJsonParse({ status: "idle", fileId: selected.id });
      }
      return;
    }
    if (selected.kind === "html") {
      if (htmlParse.fileId !== selected.id) {
        setHtmlParse({ status: "idle", fileId: selected.id });
      }
    }

    setLabelsPage(1);
  }, [selected, htmlParse.fileId, jsonParse.fileId]);

  const onPickFiles = React.useCallback((list: FileList | null) => {
    if (!list?.length) return;

    const next: FileItem[] = [];
    for (const file of Array.from(list)) {
      const kind = detectKind(file);
      if (!kind) continue;
      const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
      next.push({ id, file, kind, addedAt: Date.now() });
    }

    if (next.length === 0) return;

    setFiles((prev) => {
      const merged = [...next, ...prev];
      return merged;
    });

    setSelectedId((prevSelected) => prevSelected ?? next[0].id);
  }, []);

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      onPickFiles(e.dataTransfer.files);
    },
    [onPickFiles]
  );

  const removeFile = React.useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((prev) => {
      if (prev !== id) return prev;
      const remaining = files.filter((f) => f.id !== id);
      return remaining[0]?.id ?? null;
    });

    setJsonParse((prev) => {
      if (prev.fileId !== id) return prev;
      return { status: "idle", fileId: null };
    });

    setHtmlParse((prev) => {
      if (prev.fileId !== id) return prev;
      return { status: "idle", fileId: null };
    });
  }, [files]);

  const clearAll = React.useCallback(() => {
    setFiles([]);
    setSelectedId(null);
    setJsonParse({ status: "idle", fileId: null });
    setHtmlParse({ status: "idle", fileId: null });
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Import Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Import your files here
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Import</CardTitle>
            <CardDescription>
              Drag & drop files or browse. Supported: JSON, CSV, HTML, PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div
              className={cn(
                "group relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors",
                isDragging
                  ? "border-ring bg-accent/40"
                  : "hover:bg-accent/30"
              )}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
            >
              <div className="flex size-12 items-center justify-center rounded-full border bg-background">
                <FileUp className="size-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">
                  Drop files here
                </div>
                <div className="text-xs text-muted-foreground">
                  or click to browse your computer
                </div>
              </div>

              <Input
                ref={inputRef}
                type="file"
                multiple
                accept=".json,.csv,.html,.htm,.pdf"
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Import queue
              </Label>
              {files.length === 0 ? (
                <div className="rounded-lg border bg-background px-4 py-6 text-sm text-muted-foreground">
                  No files added yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((item) => {
                    const Icon = kindIcon(item.kind);
                    const isSelected = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-3 text-left transition-colors",
                          isSelected
                            ? "border-ring"
                            : "hover:bg-accent/30"
                        )}
                      >
                        <div className="flex size-9 items-center justify-center rounded-md border bg-muted/30">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {item.file.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{kindLabel(item.kind)}</span>
                            <span>•</span>
                            <span>{formatBytes(item.file.size)}</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeFile(item.id);
                          }}
                          aria-label={`Remove ${item.file.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              Add files
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={clearAll}
              disabled={files.length === 0}
            >
              Clear
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {selected
                ? selected.kind === "json"
                  ? "Showing parsed JSON (client-side)."
                  : selected.kind === "html"
                    ? "Showing parsed HTML fields + preview (client-side)."
                    : `Showing mock output for ${selected.file.name}`
                : "Select a file to see a preview."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <PreviewModeButton
                active={previewMode === "labels"}
                onClick={() => setPreviewMode("labels")}
              >
                Labels
              </PreviewModeButton>
              <PreviewModeButton
                active={previewMode === "table"}
                onClick={() => setPreviewMode("table")}
              >
                Table
              </PreviewModeButton>
              <PreviewModeButton
                active={previewMode === "raw"}
                onClick={() => setPreviewMode("raw")}
              >
                Raw
              </PreviewModeButton>
            </div>

            {!selected ? (
              <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                Add a file on the left to see what the parsed output will look
                like.
              </div>
            ) : selected.kind === "json" && jsonParse.status === "idle" ? (
              <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                Click <span className="font-medium text-foreground">Parse</span> to load and render your JSON.
              </div>
            ) : selected.kind === "json" && jsonParse.status === "loading" ? (
              <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                Parsing JSON…
              </div>
            ) : selected.kind === "json" && jsonParse.status === "error" ? (
              <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">Couldn’t parse JSON</div>
                <div className="mt-1 text-xs">{jsonParse.message}</div>
              </div>
            ) : selected.kind === "json" && jsonParse.status === "success" ? (
              previewMode === "labels" ? (
                <PaginatedKeyValueGrid
                  items={jsonToLabels(jsonParse.value, 500)}
                  page={labelsPage}
                  pageSize={labelsPageSize}
                  showFullKeys={showFullKeys}
                  onPageChange={setLabelsPage}
                  onPageSizeChange={(n) => {
                    setLabelsPageSize(n);
                    setLabelsPage(1);
                  }}
                  onToggleShowFullKeys={() => setShowFullKeys((v) => !v)}
                />
              ) : previewMode === "table" ? (
                (() => {
                  const table = jsonToTable(jsonParse.value);
                  if (!table) {
                    return (
                      <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                        Table preview is available when the JSON root is an array of objects.
                      </div>
                    );
                  }
                  return <SimpleTable columns={table.columns} rows={table.rows} />;
                })()
              ) : (
                <div className="rounded-lg border bg-background">
                  <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-5 text-foreground">
                    {jsonParse.pretty}
                  </pre>
                </div>
              )
            ) : selected.kind === "html" && htmlParse.status === "idle" ? (
              <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                Click <span className="font-medium text-foreground">Parse</span> to extract fields (title, headings, links) and preview the HTML.
              </div>
            ) : selected.kind === "html" && htmlParse.status === "loading" ? (
              <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                Parsing HTML…
              </div>
            ) : selected.kind === "html" && htmlParse.status === "error" ? (
              <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">Couldn’t parse HTML</div>
                <div className="mt-1 text-xs">{htmlParse.message}</div>
              </div>
            ) : selected.kind === "html" && htmlParse.status === "success" ? (
              previewMode === "labels" ? (
                <PaginatedKeyValueGrid
                  items={htmlToLabels(htmlParse.value)}
                  page={labelsPage}
                  pageSize={labelsPageSize}
                  showFullKeys={showFullKeys}
                  onPageChange={setLabelsPage}
                  onPageSizeChange={(n) => {
                    setLabelsPageSize(n);
                    setLabelsPage(1);
                  }}
                  onToggleShowFullKeys={() => setShowFullKeys((v) => !v)}
                />
              ) : previewMode === "table" ? (
                (() => {
                  const table = htmlToTable(htmlParse.value);
                  if (table.rows.length === 0) {
                    return (
                      <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                        No headings or links were found.
                      </div>
                    );
                  }
                  return <SimpleTable columns={table.columns} rows={table.rows} />;
                })()
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-background">
                    <pre className="max-h-[220px] overflow-auto p-4 text-xs leading-5 text-foreground">
                      {htmlParse.value.raw}
                    </pre>
                  </div>
                  <div className="overflow-hidden rounded-lg border bg-background">
                    <div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">
                      Rendered preview
                    </div>
                    <iframe
                      title="HTML Preview"
                      className="h-[260px] w-full bg-white"
                      sandbox=""
                      srcDoc={htmlParse.value.raw}
                    />
                  </div>
                </div>
              )
            ) : previewMode === "labels" ? (
              <PaginatedKeyValueGrid
                items={MOCK_LABELS[selected.kind]}
                page={labelsPage}
                pageSize={labelsPageSize}
                showFullKeys={showFullKeys}
                onPageChange={setLabelsPage}
                onPageSizeChange={(n) => {
                  setLabelsPageSize(n);
                  setLabelsPage(1);
                }}
                onToggleShowFullKeys={() => setShowFullKeys((v) => !v)}
              />
            ) : previewMode === "table" ? (
              MOCK_TABLE[selected.kind] ? (
                <SimpleTable
                  columns={MOCK_TABLE[selected.kind]!.columns}
                  rows={MOCK_TABLE[selected.kind]!.rows}
                />
              ) : (
                <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                  Table preview isn’t available for {kindLabel(selected.kind)}
                  yet.
                </div>
              )
            ) : (
              <div className="rounded-lg border bg-background">
                <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-5 text-foreground">
                  {MOCK_RAW[selected.kind]}
                </pre>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={
                !selected ||
                !["json", "html"].includes(selected.kind) ||
                jsonParse.status === "loading" ||
                htmlParse.status === "loading"
              }
              onClick={parseSelected}
            >
              Parse
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
