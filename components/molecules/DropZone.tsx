"use client";

import * as React from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/atoms/input";

interface DropZoneProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onPickFiles: (list: FileList | null) => void | Promise<void>;
}

export function DropZone({
  inputRef,
  isDragging,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onPickFiles,
}: DropZoneProps) {
  return (
    <div
      className={cn(
        "group relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300",
        isDragging
          ? "border-purple-500 bg-purple-50 scale-[1.02] shadow-lg"
          : "border-purple-300/60 hover:border-purple-400 hover:bg-purple-50/50"
      )}
      onClick={() => inputRef.current?.click()}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
    >
      <div
        className={cn(
          "flex size-16 items-center justify-center rounded-xl border-2 bg-white shadow-sm transition-all duration-300",
          isDragging
            ? "border-purple-400 scale-110"
            : "border-purple-200 group-hover:border-purple-300 group-hover:scale-105"
        )}
      >
        <FileUp
          className={cn(
            "size-7 transition-colors",
            isDragging ? "text-purple-600" : "text-purple-400 group-hover:text-purple-500"
          )}
        />
      </div>
      <div className="space-y-1.5">
        <div
          className={cn(
            "text-base font-semibold transition-colors",
            isDragging ? "text-purple-700" : "text-slate-700"
          )}
        >
          Drag and drop or <span className="text-purple-600 underline underline-offset-2">browse</span>
        </div>
        <div className="text-sm text-slate-500">
          Credit reports must be original PDF files downloaded from AnnualCreditReport.com and created within seven days of each other.
        </div>
      </div>

      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="file"
        multiple
        accept=".json,.csv,.html,.htm,.pdf"
        className="hidden"
        onChange={(e) => onPickFiles(e.target.files)}
      />
    </div>
  );
}
