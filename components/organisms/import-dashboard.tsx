"use client";

import * as React from "react";

import {
  detectKind,
  extractNestedKeys,
  ingestUploadedDocument,
  parseHtmlToFields,
} from "@/lib/utils";

import { ImporterSection } from "@/components/organisms/sections/importer-section";
import { PreviewParsedSection } from "@/components/organisms/sections/preview-parsed-section";
import { LetterPreviewSection } from "@/components/organisms/sections/letter-preview-section";
import {
  CreditTrilogyModal,
  type BureauAssignment,
  type BureauType,
  type ImportedFile,
} from "@/components/organisms/credit-trilogy-modal";

import type {
  CanonicalFieldDto,
  FieldMappingDraft,
  FileItem,
  HtmlParseState,
  JsonParseState,
  PreviewMode,
  SavedUploadedDocument,
  SupportedKind,
} from "@/lib/import-dashboard.types";

const SOURCE_TYPES = ["EXPERIAN", "EQUIFAX", "ARRAY", "OTHER"] as const;

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

export default function ImportDashboard() {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [savedDocs, setSavedDocs] = React.useState<SavedUploadedDocument[]>([]);
  const [selectedSavedId, setSelectedSavedId] = React.useState<string | null>(null);
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

  const [canonicalFields, setCanonicalFields] = React.useState<CanonicalFieldDto[]>([]);
  const [canonicalFieldsError, setCanonicalFieldsError] = React.useState<string | null>(null);

  const [sourceType, setSourceType] = React.useState<string>(SOURCE_TYPES[0]);
  const [fieldMappings, setFieldMappings] = React.useState<FieldMappingDraft>({});
  const [savingMappings, setSavingMappings] = React.useState(false);
  const [mappingSaveResult, setMappingSaveResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [letterItems, setLetterItems] = React.useState<Array<{ label: string; value: string }>>([]);
  const [trilogyOpen, setTrilogyOpen] = React.useState(false);
  const [bureauAssignments, setBureauAssignments] = React.useState<BureauAssignment>({
    transunion: null,
    experian: null,
    equifax: null,
  });

  const loadSavedDocs = React.useCallback(async () => {
    const res = await fetch("/api/uploaded-documents", {
      method: "GET",
      headers: { "content-type": "application/json" },
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(err?.error ?? `Failed to load saved imports (${res.status})`);
    }

    const data = (await res.json()) as { items?: SavedUploadedDocument[] };
    setSavedDocs(Array.isArray(data.items) ? data.items : []);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCanonicalFields() {
      try {
        setCanonicalFieldsError(null);
        const res = await fetch("/api/canonical-fields", {
          method: "GET",
          headers: { "content-type": "application/json" },
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? `Failed to load canonical fields (${res.status})`);
        }

        const data = (await res.json()) as { fields?: CanonicalFieldDto[] };
        if (cancelled) return;

        setCanonicalFields(Array.isArray(data.fields) ? data.fields : []);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Failed to load canonical fields";
        setCanonicalFieldsError(message);
      }
    }

    void loadCanonicalFields();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    void loadSavedDocs();
  }, [loadSavedDocs]);

  const selected = React.useMemo(
    () => files.find((f) => f.id === selectedId) ?? null,
    [files, selectedId]
  );

  const selectedSaved = React.useMemo(
    () => savedDocs.find((d) => d.id === selectedSavedId) ?? null,
    [savedDocs, selectedSavedId]
  );

  const letterInput = React.useMemo(() => {
    if (selectedSaved) {
      return {
        fileName: selectedSaved.filename,
        kindLabel: "saved import",
        parsed: selectedSaved.parsedData,
      };
    }

    if (selected?.kind === "json" && jsonParse.status === "success") {
      return {
        fileName: selected.file.name,
        kindLabel: "json",
        parsed: jsonParse.value,
      };
    }

    if (selected?.kind === "html" && htmlParse.status === "success") {
      return {
        fileName: selected.file.name,
        kindLabel: "html",
        parsed: htmlParse.value,
      };
    }

    return null;
  }, [htmlParse, jsonParse, selected, selectedSaved]);

  const letterContextKey = React.useMemo(() => {
    if (!letterInput) return null;
    return `${letterInput.kindLabel}:${letterInput.fileName}`;
  }, [letterInput]);

  React.useEffect(() => {
    setLetterItems([]);
  }, [letterContextKey]);

  const sendItemToLetter = React.useCallback(
    (item: { label: string; value: string }) => {
      if (!letterInput) return;

      setLetterItems((prev) => {
        if (prev.some((p) => p.label === item.label)) return prev;
        return [...prev, item];
      });

      window.setTimeout(() => {
        document.getElementById("letter-preview")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    },
    [letterInput]
  );

  const extractedKeys = React.useMemo(() => {
    if (jsonParse.status !== "success") return [];
    return extractNestedKeys(jsonParse.value, "", 10, {
      arraySampleSize: 25,
      maxKeys: 15000,
    });
  }, [jsonParse]);

  const importedFiles = React.useMemo<ImportedFile[]>(() => {
    const result: ImportedFile[] = [];

    for (const file of files) {
      if (file.kind === "json" && jsonParse.status === "success" && jsonParse.fileId === file.id) {
        const data = jsonParse.value as Record<string, unknown>;
        result.push({
          id: file.id,
          name: file.file.name,
          kind: file.kind,
          data,
          keys: extractNestedKeys(data, "", 10, { arraySampleSize: 25, maxKeys: 5000 }),
        });
      }
    }

    for (const doc of savedDocs) {
      if (doc.parsedData && typeof doc.parsedData === "object") {
        const data = doc.parsedData as Record<string, unknown>;
        result.push({
          id: doc.id,
          name: doc.filename,
          kind: doc.mimeType.includes("json") ? "json" : "other",
          data,
          keys: extractNestedKeys(data, "", 10, { arraySampleSize: 25, maxKeys: 5000 }),
        });
      }
    }

    return result;
  }, [files, jsonParse, savedDocs]);

  const handleBureauAssign = React.useCallback((bureau: BureauType, fileId: string | null) => {
    setBureauAssignments((prev) => ({ ...prev, [bureau]: fileId }));
  }, []);

  React.useEffect(() => {
    if (extractedKeys.length > 0) {
      setFieldMappings((prev) => {
        const next: FieldMappingDraft = {};
        for (const key of extractedKeys) {
          next[key] = prev[key] ?? "";
        }
        return next;
      });
      setMappingSaveResult(null);
    }
  }, [extractedKeys]);

  const handleAutoMap = React.useCallback(() => {
    if (extractedKeys.length === 0 || canonicalFields.length === 0) return;

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[_\-\s]/g, "");

    const canonicalNormalized = canonicalFields.map((cf) => ({
      name: cf.name,
      normalized: normalize(cf.name),
    }));

    const newMappings: FieldMappingDraft = {};
    let matchCount = 0;

    for (const key of extractedKeys) {
      const shortKey = key.includes(".") ? key.split(".").pop() ?? key : key;
      const normalizedKey = normalize(shortKey);

      const match = canonicalNormalized.find(
        (cf) =>
          cf.normalized === normalizedKey ||
          normalizedKey.includes(cf.normalized) ||
          cf.normalized.includes(normalizedKey)
      );

      if (match) {
        newMappings[key] = match.name;
        matchCount++;
      } else {
        newMappings[key] = "";
      }
    }

    setFieldMappings(newMappings);
    setMappingSaveResult({
      success: true,
      message: `Auto-mapped ${matchCount} of ${extractedKeys.length} fields`,
    });
  }, [extractedKeys, canonicalFields]);

  const handleSaveMappings = React.useCallback(async () => {
    const mappingsToSave = Object.entries(fieldMappings)
      .filter(([, target]) => target !== "")
      .map(([sourceField, targetField]) => ({ sourceField, targetField }));

    if (mappingsToSave.length === 0) {
      setMappingSaveResult({ success: false, message: "No mappings to save. Select at least one target field." });
      return;
    }

    setSavingMappings(true);
    setMappingSaveResult(null);

    try {
      const res = await fetch("/api/field-mappings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceType, mappings: mappingsToSave }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `Failed to save mappings (${res.status})`);
      }

      const data = (await res.json()) as { saved?: number };
      setMappingSaveResult({ success: true, message: `Saved ${data.saved ?? 0} mapping(s) for ${sourceType}` });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save mappings";
      setMappingSaveResult({ success: false, message });
    } finally {
      setSavingMappings(false);
    }
  }, [fieldMappings, sourceType]);

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

  const uploadFile = React.useCallback(
    async (file: File, kind: SupportedKind) => {
      setUploadError(null);
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      form.set("sourceType", "ManualUpload");

      if (kind === "json") {
        try {
          const value = JSON.parse(await file.text()) as unknown;
          form.set("parsedData", JSON.stringify(value));
        } catch {
          // ignore
        }
      }

      if (kind === "html") {
        try {
          const parsed = parseHtmlToFields(await file.text());
          form.set("parsedData", JSON.stringify(parsed));
        } catch {
          // ignore
        }
      }

      const res = await fetch("/api/uploaded-documents", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setUploadError(err?.error ?? `Upload failed (${res.status})`);
        return;
      }

      const data = (await res.json()) as { item?: SavedUploadedDocument };
      if (!data.item) return;
      setSavedDocs((prev) => [data.item!, ...prev]);

      void ingestUploadedDocument(data.item.id).catch(() => {
        // ignore
      });
    },
    []
  );

  const onPickFiles = React.useCallback(async (list: FileList | null) => {
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

    setSelectedSavedId(null);

    await Promise.allSettled(next.map((item) => uploadFile(item.file, item.kind)));
  }, [uploadFile]);

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
          Credit Import Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Import credit report files to view and analyze bureau data
        </p>
      </header>

      <CreditTrilogyModal
        open={trilogyOpen}
        onOpenChange={setTrilogyOpen}
        importedFiles={importedFiles}
        assignments={bureauAssignments}
        onAssign={handleBureauAssign}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <ImporterSection
          inputRef={inputRef}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onDrop={onDrop}
          onPickFiles={onPickFiles}
          files={files}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          removeFile={removeFile}
          clearAll={clearAll}
          uploadError={uploadError}
          savedDocs={savedDocs}
          selectedSavedId={selectedSavedId}
          setSelectedSavedId={setSelectedSavedId}
          loadSavedDocs={loadSavedDocs}
        />

        <PreviewParsedSection
          selectedSaved={selectedSaved}
          selected={selected}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          jsonParse={jsonParse}
          htmlParse={htmlParse}
          labelsPage={labelsPage}
          setLabelsPage={setLabelsPage}
          labelsPageSize={labelsPageSize}
          setLabelsPageSize={setLabelsPageSize}
          showFullKeys={showFullKeys}
          setShowFullKeys={setShowFullKeys}
          extractedKeys={extractedKeys}
          sourceType={sourceType}
          setSourceType={setSourceType}
          fieldMappings={fieldMappings}
          setFieldMappings={setFieldMappings}
          canonicalFields={canonicalFields}
          canonicalFieldsError={canonicalFieldsError}
          handleAutoMap={handleAutoMap}
          handleSaveMappings={handleSaveMappings}
          savingMappings={savingMappings}
          mappingSaveResult={mappingSaveResult}
          SOURCE_TYPES={SOURCE_TYPES}
          MOCK_LABELS={MOCK_LABELS}
          MOCK_TABLE={MOCK_TABLE}
          MOCK_RAW={MOCK_RAW}
          parseSelected={parseSelected}
          onSendToLetter={letterInput ? sendItemToLetter : undefined}
          onOpenTrilogy={() => setTrilogyOpen(true)}
          trilogyFileCount={importedFiles.length}
        />
      </div>

      {letterInput ? (
        <div id="letter-preview">
          <LetterPreviewSection
            fileName={letterInput.fileName}
            kindLabel={letterInput.kindLabel}
            parsed={letterInput.parsed}
            items={letterItems}
            setItems={setLetterItems}
          />
        </div>
      ) : null}
    </div>
  );
}
