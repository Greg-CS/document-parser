import * as React from "react";
import { FileUp, Trash2 } from "lucide-react";

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
import { cn, formatBytes, kindIcon, kindLabel } from "@/lib/utils";

import type { FileItem, SavedUploadedDocument } from "@/lib/import-dashboard.types";

export function ImporterSection({
  inputRef,
  isDragging,
  setIsDragging,
  onDrop,
  onPickFiles,
  files,
  selectedId,
  setSelectedId,
  removeFile,
  clearAll,
  uploadError,
  savedDocs,
  selectedSavedId,
  setSelectedSavedId,
  loadSavedDocs,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  onDrop: (e: React.DragEvent) => void;
  onPickFiles: (list: FileList | null) => void | Promise<void>;
  files: FileItem[];
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  removeFile: (id: string) => void;
  clearAll: () => void;
  uploadError: string | null;
  savedDocs: SavedUploadedDocument[];
  selectedSavedId: string | null;
  setSelectedSavedId: React.Dispatch<React.SetStateAction<string | null>>;
  loadSavedDocs: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import</CardTitle>
        <CardDescription>
          Drag & drop files or browse. Supported: JSON, CSV, HTML, PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {uploadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {uploadError}
          </div>
        ) : null}

        <div
          className={cn(
            "group relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors",
            isDragging ? "border-ring bg-accent/40" : "hover:bg-accent/30"
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
            <div className="text-sm font-medium text-foreground">Drop files here</div>
            <div className="text-xs text-muted-foreground">or click to browse your computer</div>
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
          <Label className="text-xs text-muted-foreground">Import queue</Label>
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
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(item.id);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-3 text-left transition-colors",
                      isSelected ? "border-ring" : "hover:bg-accent/30"
                    )}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex size-9 items-center justify-center rounded-md border bg-muted/30">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{item.file.name}</div>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Saved imports</Label>
          {savedDocs.length === 0 ? (
            <div className="rounded-lg border bg-background px-4 py-6 text-sm text-muted-foreground">
              No saved imports yet.
            </div>
          ) : (
            <div className="space-y-2">
              {savedDocs.slice(0, 12).map((doc) => {
                const isSelected = doc.id === selectedSavedId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedSavedId(doc.id);
                      setSelectedId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedSavedId(doc.id);
                        setSelectedId(null);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border bg-background px-3 py-3 text-left transition-colors",
                      isSelected ? "border-ring" : "hover:bg-accent/30"
                    )}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{doc.filename}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{doc.sourceType}</span>
                        <span>•</span>
                        <span>{formatBytes(doc.fileSize)}</span>
                        <span>•</span>
                        <span>
                          {doc.reports.length} report{doc.reports.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await loadSavedDocs();
                      }}
                    >
                      Refresh
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
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
  );
}
