import * as React from "react";

import { Button } from "@/components/atoms/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import { Label } from "@/components/atoms/label";
import {
  cn,
  htmlToLabels,
  htmlToTable,
  jsonToLabels,
  jsonToTable,
  kindLabel,
} from "@/lib/utils";

import { PaginatedKeyValueGrid } from "@/components/molecules/paginated-key-value-grid";
import { PreviewModeButton } from "@/components/molecules/preview-mode-button";
import { SimpleTable } from "@/components/molecules/simple-table";

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

export function PreviewParsedSection({
  selectedSaved,
  selected,
  previewMode,
  setPreviewMode,
  jsonParse,
  htmlParse,
  labelsPage,
  setLabelsPage,
  labelsPageSize,
  setLabelsPageSize,
  showFullKeys,
  setShowFullKeys,
  extractedKeys,
  sourceType,
  setSourceType,
  fieldMappings,
  setFieldMappings,
  canonicalFields,
  canonicalFieldsError,
  handleAutoMap,
  handleSaveMappings,
  savingMappings,
  mappingSaveResult,
  SOURCE_TYPES,
  MOCK_LABELS,
  MOCK_TABLE,
  MOCK_RAW,
  parseSelected,
  onSendToLetter,
  onOpenTrilogy,
  trilogyFileCount,
}: {
  selectedSaved: SavedUploadedDocument | null;
  selected: FileItem | null;
  previewMode: PreviewMode;
  setPreviewMode: React.Dispatch<React.SetStateAction<PreviewMode>>;
  jsonParse: JsonParseState;
  htmlParse: HtmlParseState;
  labelsPage: number;
  setLabelsPage: React.Dispatch<React.SetStateAction<number>>;
  labelsPageSize: number;
  setLabelsPageSize: React.Dispatch<React.SetStateAction<number>>;
  showFullKeys: boolean;
  setShowFullKeys: React.Dispatch<React.SetStateAction<boolean>>;
  extractedKeys: string[];
  sourceType: string;
  setSourceType: React.Dispatch<React.SetStateAction<string>>;
  fieldMappings: FieldMappingDraft;
  setFieldMappings: React.Dispatch<React.SetStateAction<FieldMappingDraft>>;
  canonicalFields: CanonicalFieldDto[];
  canonicalFieldsError: string | null;
  handleAutoMap: () => void;
  handleSaveMappings: () => void | Promise<void>;
  savingMappings: boolean;
  mappingSaveResult: { success: boolean; message: string } | null;
  SOURCE_TYPES: readonly string[];
  MOCK_LABELS: Record<SupportedKind, Array<{ label: string; value: string }>>;
  MOCK_TABLE: Record<SupportedKind, { columns: string[]; rows: Array<Record<string, string>> } | null>;
  MOCK_RAW: Record<SupportedKind, string>;
  parseSelected: () => void | Promise<void>;
  onSendToLetter?: (item: { label: string; value: string }) => void;
  onOpenTrilogy?: () => void;
  trilogyFileCount?: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>
          {selectedSaved
            ? "Showing saved import (from database)."
            : selected
              ? selected.kind === "json"
                ? "Showing parsed JSON (client-side)."
                : selected.kind === "html"
                  ? "Showing parsed HTML fields + preview (client-side)."
                  : `Showing mock output for ${selected.file.name}`
              : "Select a file to see a preview."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-lg border bg-background px-4 py-3">
          <div className="text-xs font-medium text-muted-foreground">Canonical fields</div>
          {canonicalFieldsError ? (
            <div className="text-xs text-muted-foreground">{canonicalFieldsError}</div>
          ) : canonicalFields.length === 0 ? (
            <div className="text-xs text-muted-foreground">No canonical fields found.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canonicalFields.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/20 px-2 py-1 text-xs text-foreground"
                  title={f.description ?? undefined}
                >
                  <span className="font-medium">{f.name}</span>
                  <span className="text-muted-foreground">({f.dataType})</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PreviewModeButton active={previewMode === "labels"} onClick={() => setPreviewMode("labels")}>
            Labels
          </PreviewModeButton>
          <PreviewModeButton active={false} onClick={() => onOpenTrilogy?.()}>
            Dashboard
          </PreviewModeButton>
          <PreviewModeButton active={previewMode === "table"} onClick={() => setPreviewMode("table")}>
            Table
          </PreviewModeButton>
          <PreviewModeButton active={previewMode === "raw"} onClick={() => setPreviewMode("raw")}>
            Raw
          </PreviewModeButton>
          {selected?.kind === "json" && jsonParse.status === "success" && (
            <PreviewModeButton active={previewMode === "mapping"} onClick={() => setPreviewMode("mapping")}>
              Mapping
            </PreviewModeButton>
          )}
        </div>

        {selectedSaved ? (
          previewMode === "labels" ? (
            <PaginatedKeyValueGrid
              items={jsonToLabels(selectedSaved.parsedData, 500)}
              page={labelsPage}
              pageSize={labelsPageSize}
              showFullKeys={showFullKeys}
              onPageChange={setLabelsPage}
              onPageSizeChange={(n) => {
                setLabelsPageSize(n);
                setLabelsPage(1);
              }}
              onToggleShowFullKeys={() => setShowFullKeys((v) => !v)}
              onSendToLetter={onSendToLetter}
            />
          ) : previewMode === "table" ? (
            (() => {
              const table = jsonToTable(selectedSaved.parsedData);
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
                {JSON.stringify(selectedSaved.parsedData, null, 2)}
              </pre>
            </div>
          )
        ) : !selected ? (
          <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
            Add a file on the left to see what the parsed output will look like.
          </div>
        ) : selected.kind === "json" && jsonParse.status === "idle" ? (
          <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
            Click <span className="font-medium text-foreground">Parse</span> to load and render your JSON.
          </div>
        ) : selected.kind === "json" && jsonParse.status === "loading" ? (
          <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">Parsing JSON…</div>
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
              onSendToLetter={onSendToLetter}
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
          ) : previewMode === "mapping" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium">Source Type</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {extractedKeys.length === 0 ? (
                <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                  No keys found in the parsed JSON.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                        <tr>
                          <th className="border-b px-3 py-2 text-left font-medium text-foreground">Source Field</th>
                          <th className="border-b px-3 py-2 text-left font-medium text-foreground">→ Maps To (Canonical)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedKeys.map((key) => (
                          <tr key={key} className="odd:bg-muted/20">
                            <td
                              className="border-b px-3 py-2 max-w-[200px] font-mono text-foreground wrap-break-word"
                              title={key}
                            >
                              {key.includes(".") ? key.split(".").pop() ?? key : key}
                            </td>
                            <td className="border-b px-3 py-2">
                              <select
                                className="h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground"
                                value={fieldMappings[key] ?? ""}
                                onChange={(e) =>
                                  setFieldMappings((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">— skip —</option>
                                {canonicalFields.map((cf) => (
                                  <option key={cf.id} value={cf.name}>
                                    {cf.name} ({cf.dataType})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutoMap}
                  disabled={extractedKeys.length === 0 || canonicalFields.length === 0}
                >
                  Auto-Map
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveMappings}
                  disabled={savingMappings || extractedKeys.length === 0}
                >
                  {savingMappings ? "Saving…" : "Save Mapping"}
                </Button>
                {mappingSaveResult && (
                  <span
                    className={cn(
                      "text-sm",
                      mappingSaveResult.success ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {mappingSaveResult.message}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-background">
              <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-5 text-foreground">{jsonParse.pretty}</pre>
            </div>
          )
        ) : selected.kind === "html" && htmlParse.status === "idle" ? (
          <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
            Click <span className="font-medium text-foreground">Parse</span> to extract fields (title, headings, links) and preview the HTML.
          </div>
        ) : selected.kind === "html" && htmlParse.status === "loading" ? (
          <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">Parsing HTML…</div>
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
              onSendToLetter={onSendToLetter}
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
                <pre className="max-h-[220px] overflow-auto p-4 text-xs leading-5 text-foreground">{htmlParse.value.raw}</pre>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                <div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">Rendered preview</div>
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
            items={MOCK_LABELS[selected.kind as SupportedKind]}
            page={labelsPage}
            pageSize={labelsPageSize}
            showFullKeys={showFullKeys}
            onPageChange={setLabelsPage}
            onPageSizeChange={(n) => {
              setLabelsPageSize(n);
              setLabelsPage(1);
            }}
            onToggleShowFullKeys={() => setShowFullKeys((v) => !v)}
            onSendToLetter={onSendToLetter}
          />
        ) : previewMode === "table" ? (
          MOCK_TABLE[selected.kind as SupportedKind] ? (
            <SimpleTable
              columns={MOCK_TABLE[selected.kind as SupportedKind]!.columns}
              rows={MOCK_TABLE[selected.kind as SupportedKind]!.rows}
            />
          ) : (
            <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
              Table preview isn’t available for {kindLabel(selected.kind)} yet.
            </div>
          )
        ) : (
          <div className="rounded-lg border bg-background">
            <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-5 text-foreground">{MOCK_RAW[selected.kind as SupportedKind]}</pre>
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
  );
}
