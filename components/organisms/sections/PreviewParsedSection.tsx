import * as React from "react";

import { Button } from "@/components/atoms/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import {
  cn,
  htmlToLabels,
  htmlToTable,
  jsonToLabels,
  jsonToTable,
  kindLabel,
  getValueAtPath,
} from "@/lib/utils";

import { PaginatedKeyValueGrid } from "@/components/molecules/essentials/PaginatedKeyValueGrid";
import { PreviewModeButton } from "@/components/molecules/essentials/preview-mode-button";
import { SimpleTable } from "@/components/molecules/TableAssets/simple-table";
import { InlineCreditReportView } from "@/components/organisms/sections/InlineCreditReportView";

import type {
  CanonicalFieldDto,
  FieldMappingDraft,
  FileItem,
  HtmlParseState,
  JsonParseState,
  PreviewMode,
  SavedUploadedDocument,
} from "@/lib/types/import-dashboard.types";
import type { ImportedFile, BureauAssignment } from "@/lib/interfaces/GlobalInterfaces";

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
  parseSelected: _parseSelected,
  onSendToLetter,
  importedFiles,
  assignments,
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
  parseSelected: () => void | Promise<void>;
  onSendToLetter?: (item: { label: string; value: string }) => void;
  FileCount?: number;
  importedFiles?: ImportedFile[];
  assignments?: BureauAssignment;
}) {
  void _parseSelected;
  void setFieldMappings;

  const mappingParsedRoot = React.useMemo(() => {
    if (selectedSaved && selectedSaved.parsedData && typeof selectedSaved.parsedData === "object") return selectedSaved.parsedData;
    if (selected?.kind === "json" && jsonParse.status === "success") return jsonParse.value;
    if (selected?.kind === "html" && htmlParse.status === "success") return htmlParse.value;
    return null;
  }, [htmlParse, jsonParse, selected?.kind, selectedSaved]);

  const normalizedOutput = React.useMemo(() => {
    if (!mappingParsedRoot) return null;

    const output: Record<string, unknown> = {};
    for (const [sourcePath, targetField] of Object.entries(fieldMappings)) {
      if (!targetField) continue;
      const value = getValueAtPath(mappingParsedRoot, sourcePath);
      if (value === undefined) continue;
      output[targetField] = value;
    }
    return output;
  }, [fieldMappings, mappingParsedRoot]);

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
        <div className="flex flex-wrap items-center gap-2">
          <PreviewModeButton active={previewMode === "report"} onClick={() => setPreviewMode("report")}>
            Report
          </PreviewModeButton>
          <PreviewModeButton active={previewMode === "mapping"} onClick={() => setPreviewMode("mapping")}>
            Normalized
          </PreviewModeButton>
          {/* Show Table button only for PDF files */}
          {selected?.kind === "pdf" && (
            <PreviewModeButton active={previewMode === "table"} onClick={() => setPreviewMode("table")}>
              Table
            </PreviewModeButton>
          )}
        </div>

        {/* Inline Credit Report View */}
        {previewMode === "report" && importedFiles && assignments ? (
          <InlineCreditReportView
            importedFiles={importedFiles}
            assignments={assignments}
            onSendToLetter={onSendToLetter ? (items: Array<{ label: string; value: string }>) => items.forEach(item => onSendToLetter(item)) : undefined}
          />
          ) 
          : previewMode === "mapping" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">Normalized output</div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handleAutoMap} disabled={extractedKeys.length === 0 || canonicalFields.length === 0}>
                    Auto-map
                  </Button>
                  <Button type="button" size="sm" variant="default" onClick={handleSaveMappings} disabled={savingMappings}>
                    {savingMappings ? "Saving…" : "Save mappings"}
                  </Button>
                </div>
              </div>

              {canonicalFieldsError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {canonicalFieldsError}
                </div>
              ) : null}

              {mappingSaveResult ? (
                <div className={cn(
                  "rounded-lg border px-4 py-3 text-sm",
                  mappingSaveResult.success ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"
                )}>
                  {mappingSaveResult.message}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-lg border bg-background p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Source type</div>
                  <select className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                    {SOURCE_TYPES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border bg-background p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Mapped fields</div>
                  <div className="text-sm text-foreground">{Object.values(fieldMappings).filter(Boolean).length}</div>
                </div>
              </div>

              {!normalizedOutput || Object.keys(normalizedOutput).length === 0 ? (
                <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
                  No mappings applied yet. Use Auto-map or assign targets in your mapping workflow.
                </div>
              ) : (
                <div className="rounded-lg border bg-background">
                  <div className="flex justify-end border-b bg-muted/30 px-3 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 bg-stone-800! text-white! hover:bg-stone-700!"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(normalizedOutput, null, 2))
                      }}
                    >
                      📋 Copy
                    </Button>
                  </div>
                  <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-5 text-foreground whitespace-pre-wrap">
                    {JSON.stringify(normalizedOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : selectedSaved ? (
            // previewMode === "labels" ? (
            //   <PaginatedKeyValueGrid
            //     items={jsonToLabels(selectedSaved.parsedData, 500)}
            //     page={labelsPage}
            //     pageSize={labelsPageSize}
            //     showFullKeys={showFullKeys}
            //     onPageChange={setLabelsPage}
            //     onPageSizeChange={(n) => {
            //       setLabelsPageSize(n);
            //       setLabelsPage(1);
            //     }}
            //     onToggleShowFullKeys={() => setShowFullKeys((v) => !v)}
            //     onSendToLetter={onSendToLetter}
            //   />
            // )
            // : 
            previewMode === "table" ? (
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
                <div className="flex justify-end border-b bg-muted/30 px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 bg-stone-800! text-white! hover:bg-stone-700!"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedSaved.parsedData, null, 2))
                    }}
                  >
                    📋 Copy
                  </Button>
                </div>
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
              <div className="font-medium text-foreground">Couldn&apos;t parse JSON</div>
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
            ) : (
              <div className="rounded-lg border bg-background">
                <div className="flex justify-end border-b bg-muted/30 px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 bg-stone-800! text-white! hover:bg-stone-700!"
                    onClick={() => {
                      navigator.clipboard.writeText(jsonParse.pretty ?? "")
                    }}
                  >
                    📋 Copy
                  </Button>
                </div>
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
                  <div className="flex justify-end border-b bg-muted/30 px-3 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 bg-stone-800! text-white! hover:bg-stone-700!"
                      onClick={() => {
                        navigator.clipboard.writeText(htmlParse.value.raw)
                      }}
                    >
                      📋 Copy
                    </Button>
                  </div>
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
          ) : previewMode === "table" ? (
          <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
            Table preview isn&apos;t available for {kindLabel(selected.kind)} yet. Parse the file first or use a JSON/HTML file.
          </div>
          ) : (
          <div className="rounded-lg border bg-background px-6 py-10 text-sm text-muted-foreground">
            Raw preview isn&apos;t available for {kindLabel(selected.kind)} yet. Parse the file first or use a JSON/HTML file.
          </div>
        )}
      </CardContent>
      {/* <CardFooter className="justify-end">
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
      </CardFooter> */}
    </Card>
  );
}
