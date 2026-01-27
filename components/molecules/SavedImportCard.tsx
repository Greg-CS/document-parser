"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import type { SavedUploadedDocument } from "@/lib/types/import-dashboard.types";

interface SavedImportCardProps {
  doc: SavedUploadedDocument;
  isSelected: boolean;
  onSelect: () => void;
  onRefresh: () => Promise<void>;
  animationDelay?: number;
}

export function SavedImportCard({
  doc,
  isSelected,
  onSelect,
  onRefresh,
  animationDelay = 0,
}: SavedImportCardProps) {
  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-xl border-2 bg-white px-4 py-3 text-left transition-all duration-200 animate-fade-in-up",
        isSelected
          ? "border-purple-400 bg-purple-50/50 shadow-md"
          : "border-slate-200 hover:border-purple-300 hover:shadow-sm"
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
      role="button"
      tabIndex={0}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold text-slate-800">{doc.filename}</div>
          {isSelected && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium">{doc.sourceType}</span>
          <span>•</span>
          <span>{formatBytes(doc.fileSize)}</span>
          <span>•</span>
          <span className="text-purple-600 font-medium">
            {doc.reports.length} report{doc.reports.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await onRefresh();
        }}
      >
        Refresh
      </Button>
    </div>
  );
}
