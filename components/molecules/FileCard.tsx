"use client";

import * as React from "react";
import { Trash2, CheckCircle2, FileJson, FileSpreadsheet, FileCode, FileText, File } from "lucide-react";
import { cn, formatBytes, kindLabel } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import type { FileItem, SupportedKind } from "@/lib/types/import-dashboard.types";

interface FileCardProps {
  item: FileItem;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  animationDelay?: number;
}

const BUREAU_COLORS = {
  transunion: "from-blue-500 to-blue-600",
  experian: "from-indigo-500 to-purple-600",
  equifax: "from-red-500 to-red-600",
} as const;

function detectBureau(filename: string): keyof typeof BUREAU_COLORS | null {
  const lower = filename.toLowerCase();
  if (lower.includes("transunion")) return "transunion";
  if (lower.includes("experian")) return "experian";
  if (lower.includes("equifax")) return "equifax";
  return null;
}

function KindIcon({ kind, className }: { kind: SupportedKind; className?: string }) {
  switch (kind) {
    case "json": return <FileJson className={className} />;
    case "csv": return <FileSpreadsheet className={className} />;
    case "html": return <FileCode className={className} />;
    case "pdf": return <FileText className={className} />;
    default: return <File className={className} />;
  }
}

export function FileCard({ item, isSelected, onSelect, onRemove, animationDelay = 0 }: FileCardProps) {
  const bureauName = detectBureau(item.file.name);

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
        "flex w-full items-center gap-4 rounded-xl border-2 bg-white px-4 py-4 text-left transition-all duration-200 animate-fade-in-up",
        isSelected
          ? "border-purple-400 bg-purple-50/50 shadow-md"
          : "border-slate-200 hover:border-purple-300 hover:shadow-sm"
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
      role="button"
      tabIndex={0}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-xl text-white shadow-sm",
          bureauName
            ? `bg-gradient-to-br ${BUREAU_COLORS[bureauName]}`
            : "bg-gradient-to-br from-slate-400 to-slate-500"
        )}
      >
        <KindIcon kind={item.kind} className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold text-slate-800">{item.file.name}</div>
          {isSelected && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium">{kindLabel(item.kind)}</span>
          <span>•</span>
          <span>{formatBytes(item.file.size)}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-slate-400 hover:text-red-500 hover:bg-red-50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${item.file.name}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
