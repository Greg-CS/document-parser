import * as React from "react";
import { Upload, FileUp } from "lucide-react";

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
import { ProcessingAnimation } from "@/components/molecules/ProcessingAnimation";
import { DropZone } from "@/components/molecules/DropZone";
import { FileCard } from "@/components/molecules/FileCard";
import { SavedImportCard } from "@/components/molecules/SavedImportCard";

import type { FileItem, SavedUploadedDocument } from "@/lib/types/import-dashboard.types";

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
  isProcessing = false,
  processingStage = "parsing",
  processingProgress = 0,
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
  isProcessing?: boolean;
  processingStage?: "uploading" | "parsing" | "merging" | "analyzing" | "complete";
  processingProgress?: number;
}) {
  // Show processing animation when isProcessing is true
  if (isProcessing) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50 min-h-[500px] flex items-center justify-center">
          <ProcessingAnimation
            stage={processingStage}
            progress={processingProgress}
            subMessage="Please wait while we analyze your credit reports..."
          />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-purple-200/50 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white">
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Reports
        </CardTitle>
        <CardDescription className="text-purple-200">
          Upload your TransUnion, Experian, and Equifax credit reports. Supported: JSON, CSV, HTML, PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {uploadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive animate-fade-in-up">
            {uploadError}
          </div>
        ) : null}

        <DropZone
          inputRef={inputRef}
          isDragging={isDragging}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
          onDrop={onDrop}
          onPickFiles={onPickFiles}
        />

        {/* My Reports Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-slate-700">My Reports</Label>
          {files.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
              <div className="text-sm text-slate-500">No files added yet</div>
              <div className="text-xs text-slate-400 mt-1">Upload your credit reports to get started</div>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((item, index) => (
                <FileCard
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  onSelect={() => setSelectedId(item.id)}
                  onRemove={() => removeFile(item.id)}
                  animationDelay={index * 50}
                />
              ))}
            </div>
          )}
        </div>

        {/* Saved Imports Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-slate-700">Saved Imports</Label>
          {savedDocs.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
              <div className="text-sm text-slate-500">No saved imports yet</div>
            </div>
          ) : (
            <div className="space-y-2">
              {savedDocs.slice(0, 12).map((doc, index) => (
                <SavedImportCard
                  key={doc.id}
                  doc={doc}
                  isSelected={doc.id === selectedSavedId}
                  onSelect={() => { setSelectedSavedId(doc.id); setSelectedId(null); }}
                  onRefresh={loadSavedDocs}
                  animationDelay={index * 50}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-3 bg-slate-50/50 border-t border-slate-100">
        <Button 
          type="button" 
          variant="outline" 
          className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="w-4 h-4 mr-2" />
          Add files
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={clearAll}
          disabled={files.length === 0}
          className="bg-red-500 hover:bg-red-600"
        >
          Clear
        </Button>
      </CardFooter>
    </Card>
  );
}
