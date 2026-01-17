import { CLAMP_2 } from "@/lib/types/Global";
import { cn, getFieldDefinition, normalizeTextDisplay, stringifyPrimitive } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/atoms/tooltip";
import { HelpCircle } from "lucide-react";

interface RowProps {
  label: string;
  shortLabel: string;
  values: [unknown, unknown, unknown];
  showFullKey?: boolean;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable]";
  }
}

function getFieldDescription(label: string): string | undefined {
  return getFieldDefinition(label) || undefined;
}

function renderCellValue(value: unknown, displayLabel?: string) {
  if (value === undefined || value === null) return "—";
  if (typeof value === "object") {
    const summary = Array.isArray(value) ? `[${value.length} items]` : "{...}";
    return (
      <details className="group inline-block text-left">
        <summary className="cursor-pointer select-none text-stone-600 underline decoration-dotted underline-offset-2">
          {summary}
        </summary>
        <pre className="mt-2 whitespace-pre-wrap wrap-break-word rounded-md bg-white/60 p-2 text-xs text-stone-700">
          {safeJsonStringify(value)}
        </pre>
      </details>
    );
  }
  const stringValue = stringifyPrimitive(value);
  const display = typeof value === "string" ? normalizeTextDisplay(stringValue) : stringValue;
  
  // Check if value matches the label (placeholder case)
  const isPlaceholder = displayLabel && 
    String(display).toLowerCase().trim() === displayLabel.toLowerCase().trim();
  
  if (isPlaceholder) {
    const description = getFieldDescription(displayLabel);
    if (description) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(CLAMP_2, "wrap-break-word flex items-center justify-center gap-1 text-stone-400 cursor-help")}>
              <span className="italic">{display}</span>
              <HelpCircle className="w-3 h-3 text-stone-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {description}
          </TooltipContent>
        </Tooltip>
      );
    }
    // No description available, show as placeholder style
    return (
      <div className={cn(CLAMP_2, "wrap-break-word text-stone-400 italic")} title={String(display)}>
        {display}
      </div>
    );
  }
  
  return (
    <div className={cn(CLAMP_2, "wrap-break-word")} title={String(display)}>
      {display}
    </div>
  );
}

export function ReportRow({ label, shortLabel, values, showFullKey }: RowProps) {
  const displayLabel = showFullKey ? label : normalizeTextDisplay(shortLabel);
  const displayTitle = showFullKey ? label : displayLabel;
  
  return (
    <tr className="hover:bg-amber-100/40 transition-colors">
      <td
        className="py-2 px-3 text-sm font-medium text-stone-700 border-r border-amber-200/80 align-top"
        title={displayTitle}
      >
        <div className="flex items-center gap-1">
          <div className={cn(CLAMP_2, "wrap-break-word")}>{displayLabel}</div>
          {(() => {
            const description = getFieldDescription(displayLabel);
            if (description) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-stone-400 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {description}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return null;
          })()}
        </div>
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 border-r border-amber-200/80 align-top">
        {renderCellValue(values[0], displayLabel)}
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 border-r border-amber-200/80 align-top">
        {renderCellValue(values[1], displayLabel)}
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 align-top">
        {renderCellValue(values[2], displayLabel)}
      </td>
    </tr>
  );
}