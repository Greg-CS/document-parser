"use client";

import * as React from "react";

import {
  detectKind,
  extractNestedKeys,
  ingestUploadedDocument,
  parseHtmlToFields,
} from "@/lib/utils";

import { ImporterSection } from "@/components/organisms/sections/ImporterSection";
import { PreviewParsedSection } from "@/components/organisms/sections/PreviewParsedSection";
import { LetterPreviewSection } from "@/components/organisms/sections/letter-preview-section";
import {
  type BureauAssignment,
  type ImportedFile,
} from "@/lib/interfaces/GlobalInterfaces";
import { type BureauType } from "@/lib/types/Global";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/atoms/button";

import type {
  CanonicalFieldDto,
  FieldMappingDraft,
  FileItem,
  HtmlParseState,
  JsonParseState,
  PreviewMode,
  SavedUploadedDocument,
  SupportedKind,
} from "@/lib/types/import-dashboard.types";
import { DashboardHeader } from "./sections/DashboardHeader";

async function notifyN8nWebhook(payload: Record<string, unknown>) {
  try {
    await fetch("/api/n8n-webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore
  }
}

 function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === "object" && value !== null;
 }

 function bureauMatchesSourceType(sourceType: unknown, bureau: BureauType): boolean {
   if (typeof sourceType !== "string") return false;
   const normalized = sourceType.toLowerCase();
   if (bureau === "equifax") return normalized.includes("equifax") || normalized === "efx";
   if (bureau === "experian") return normalized.includes("experian") || normalized === "exp";
   return normalized.includes("transunion") || normalized === "tu";
 }

 function bureauMatchesCreditFileId(creditFileId: unknown, bureau: BureauType): boolean {
   if (typeof creditFileId !== "string") return false;
   const id = creditFileId.toUpperCase();
   if (bureau === "equifax") return /\bEA\d*\b/.test(id);
   if (bureau === "experian") return /\bRA\d*\b/.test(id);
   return /\bTA\d*\b/.test(id);
 }

 function isBureauSpecificObject(value: unknown, bureau: BureauType): boolean {
   if (!isRecord(value)) return false;

   const sourceType = value["@_SourceType"] ?? value["@SourceType"];
   if (bureauMatchesSourceType(sourceType, bureau)) return true;

   const creditFileId = value["@CreditFileID"];
   if (bureauMatchesCreditFileId(creditFileId, bureau)) return true;

   const creditRepository = value["CREDIT_REPOSITORY"];
   if (Array.isArray(creditRepository)) {
     return creditRepository.some((r) => isBureauSpecificObject(r, bureau));
   }
   if (isRecord(creditRepository)) {
     return isBureauSpecificObject(creditRepository, bureau);
   }

   return false;
 }

 function shouldKeepKeyForBureau(key: string, bureau: BureauType): boolean {
   const upper = key.toUpperCase();
   const mentionsEquifax = upper.includes("EQUIFAX") || upper.endsWith("_EFX") || upper.endsWith("_EQ");
   const mentionsExperian = upper.includes("EXPERIAN") || upper.endsWith("_EXP") || upper.endsWith("_EX");
   const mentionsTransunion = upper.includes("TRANSUNION") || upper.endsWith("_TU") || upper.endsWith("_TRU");

   if (mentionsEquifax || mentionsExperian || mentionsTransunion) {
     if (bureau === "equifax") return mentionsEquifax;
     if (bureau === "experian") return mentionsExperian;
     return mentionsTransunion;
   }

   return true;
 }

 function filterForBureau(value: unknown, bureau: BureauType, depth = 0): unknown {
   if (depth > 8) return value;
   if (Array.isArray(value)) {
     const filtered = value.filter((item) => {
       if (!isRecord(item)) return true;
       const hasMarker =
         typeof item["@CreditFileID"] === "string" ||
         typeof item["@_SourceType"] === "string" ||
         typeof item["@SourceType"] === "string" ||
         item["CREDIT_REPOSITORY"] !== undefined;
       if (!hasMarker) return true;
       return isBureauSpecificObject(item, bureau);
     });
     return filtered.map((item) => filterForBureau(item, bureau, depth + 1));
   }
   if (!isRecord(value)) return value;

   const next: Record<string, unknown> = {};
   for (const [k, v] of Object.entries(value)) {
     if (depth <= 1 && !shouldKeepKeyForBureau(k, bureau)) continue;
     next[k] = filterForBureau(v, bureau, depth + 1);
   }
   return next;
 }

 function splitCombinedCreditReport(data: Record<string, unknown>): Record<BureauType, Record<string, unknown>> | null {
   const cr = data["CREDIT_RESPONSE"];
   if (!isRecord(cr)) return null;

   const included = cr["CREDIT_REPOSITORY_INCLUDED"];
   const likelyCombined =
     isRecord(included) &&
     Object.values(included).some((v) => String(v).toUpperCase() === "Y") &&
     (Array.isArray(cr["CREDIT_LIABILITY"]) || Array.isArray(cr["CREDIT_INQUIRY"]) || Array.isArray(cr["CREDIT_FILE"])) ;

   if (!likelyCombined) return null;

   const result: Record<BureauType, Record<string, unknown>> = {
     transunion: { ...data, CREDIT_RESPONSE: filterForBureau(cr, "transunion", 0) as Record<string, unknown> },
     experian: { ...data, CREDIT_RESPONSE: filterForBureau(cr, "experian", 0) as Record<string, unknown> },
     equifax: { ...data, CREDIT_RESPONSE: filterForBureau(cr, "equifax", 0) as Record<string, unknown> },
   };

   return result;
 }

 function normalizeParsedJsonRoot(value: unknown): Record<string, unknown> | null {
   if (Array.isArray(value)) {
     const first = value[0];
     return isRecord(first) ? (first as Record<string, unknown>) : null;
   }
   return isRecord(value) ? (value as Record<string, unknown>) : null;
 }

const SOURCE_TYPES = ["EXPERIAN", "EQUIFAX", "ARRAY", "OTHER"] as const;

export default function Dashboard() {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [savedDocs, setSavedDocs] = React.useState<SavedUploadedDocument[]>([]);
  const [selectedSavedId, setSelectedSavedId] = React.useState<string | null>(null);
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("report");
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
  const [showImporter, setShowImporter] = React.useState(false);
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

  const extractedKeys = React.useMemo(() => {
    if (jsonParse.status !== "success") return [];
    return extractNestedKeys(jsonParse.value, "", 10, {
      arraySampleSize: 25,
      maxKeys: 15000,
    });
  }, [jsonParse]);

  const rawImportedFiles = React.useMemo<ImportedFile[]>(() => {
    const result: ImportedFile[] = [];

    for (const file of files) {
      if (file.kind === "json" && jsonParse.status === "success" && jsonParse.fileId === file.id) {
        const data = normalizeParsedJsonRoot(jsonParse.value);
        if (!data) continue;
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
        const data = normalizeParsedJsonRoot(doc.parsedData);
        if (!data) continue;
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

  const ImportedFiles = React.useMemo<ImportedFile[]>(() => {
    const expanded: ImportedFile[] = [];

    for (const file of rawImportedFiles) {
      const split = splitCombinedCreditReport(file.data);
      if (!split) {
        expanded.push(file);
        continue;
      }

      const bureaus: Array<{ bureau: BureauType; label: string }> = [
        { bureau: "transunion", label: "TransUnion" },
        { bureau: "experian", label: "Experian" },
        { bureau: "equifax", label: "Equifax" },
      ];

      for (const { bureau, label } of bureaus) {
        const data = split[bureau];
        expanded.push({
          id: `${file.id}:${bureau}`,
          name: `${file.name} (${label})`,
          kind: file.kind,
          data,
          keys: extractNestedKeys(data, "", 10, { arraySampleSize: 25, maxKeys: 5000 }),
        });
      }
    }

    return expanded;
  }, [rawImportedFiles]);

  const [fileAttachments, setFileAttachments] = React.useState<Array<{ data: string; mimeType: string; fileName: string }>>([]);

  // Convert File to base64 for AI context
  React.useEffect(() => {
    const loadFileData = async () => {
      if (!selected?.file) {
        setFileAttachments([]);
        return;
      }

      try {
        const file = selected.file;
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        
        const mimeTypeMap: Record<string, string> = {
          pdf: "application/pdf",
          html: "text/html",
          json: "application/json",
          csv: "text/csv",
        };

        setFileAttachments([{
          data: base64,
          mimeType: mimeTypeMap[selected.kind] || "application/octet-stream",
          fileName: file.name,
        }]);
      } catch (error) {
        console.error("Failed to read file for AI context:", error);
        setFileAttachments([]);
      }
    };

    loadFileData();
  }, [selected]);

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

    // Fallback: use first imported file if available (for when files are auto-parsed)
    if (rawImportedFiles.length > 0) {
      const first = rawImportedFiles[0];
      return {
        fileName: first.name,
        kindLabel: first.kind,
        parsed: first.data,
      };
    }

    return null;
  }, [htmlParse, jsonParse, selected, selectedSaved, rawImportedFiles]);

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

  // Auto-assign first imported file to all bureaus when available
  React.useEffect(() => {
    if (ImportedFiles.length === 0) return;
    const exists = (id: string | null) => (id ? ImportedFiles.some((f) => f.id === id) : false);

    setBureauAssignments((prev) => {
      const tuDefault = ImportedFiles.find((f) => f.id.endsWith(":transunion"))?.id ?? ImportedFiles[0].id;
      const exDefault = ImportedFiles.find((f) => f.id.endsWith(":experian"))?.id ?? ImportedFiles[0].id;
      const eqDefault = ImportedFiles.find((f) => f.id.endsWith(":equifax"))?.id ?? ImportedFiles[0].id;

      const next = {
        transunion: exists(prev.transunion) ? prev.transunion : tuDefault,
        experian: exists(prev.experian) ? prev.experian : exDefault,
        equifax: exists(prev.equifax) ? prev.equifax : eqDefault,
      };

      const unchanged =
        next.transunion === prev.transunion && next.experian === prev.experian && next.equifax === prev.equifax;
      return unchanged ? prev : next;
    });
  }, [ImportedFiles]);

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

      void notifyN8nWebhook({
        event: "file_submitted",
        uploadedDocumentId: data.item.id,
        filename: data.item.filename,
        sourceType: data.item.sourceType,
        kind,
      });

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
      <DashboardHeader />

      {/* Hidden modal - kept for potential future use */}
      {/* <CreditModal
        open={Open}
        onOpenChange={setOpen}
        importedFiles={ImportedFiles}
        assignments={bureauAssignments}
        onAssign={handleBureauAssign}
      /> */}

      {/* Show only importer when no files imported */}
      {ImportedFiles.length === 0 ? (
        <div className="max-w-xl mx-auto">
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
        </div>
      ) : (
        <div className="relative">
          {/* Toggle button for importer overlay */}
          <Button
            variant="outline"
            size="sm"
            className="fixed bottom-6 right-6 z-40 shadow-lg bg-white hover:bg-stone-50"
            onClick={() => setShowImporter(!showImporter)}
          >
            {showImporter ? <X className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {showImporter ? "Close Import" : "Import Files"}
          </Button>

          {/* Importer overlay - higher z-index */}
          {showImporter && (
            <div className="fixed inset-0 z-30 bg-black/50 flex items-start justify-center pt-20 px-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-auto">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold">Import Files</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowImporter(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-4">
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
                </div>
              </div>
            </div>
          )}

          {/* Full-width report view */}
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
            parseSelected={parseSelected}
            onSendToLetter={letterInput ? sendItemToLetter : undefined}
            FileCount={rawImportedFiles.length}
            importedFiles={ImportedFiles}
            assignments={bureauAssignments}
          />
        </div>
      )}

      {letterInput ? (
        <div id="letter-preview">
          <LetterPreviewSection
            fileName={letterInput.fileName}
            kindLabel={letterInput.kindLabel}
            parsed={letterInput.parsed}
            items={letterItems}
            setItems={setLetterItems}
            fileAttachments={fileAttachments}
          />
        </div>
      ) : null}
    </div>
  );
}
