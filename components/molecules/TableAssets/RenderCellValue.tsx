import { CLAMP_2 } from "@/lib/types/Global"
import { cn, safeJsonStringify, stringifyPrimitive, normalizeTextDisplay } from "@/lib/utils"

export function RenderCellValue(value: unknown) {
  if (value === undefined || value === null) return "—"
  if (typeof value === "object") {
    const summary = Array.isArray(value) ? `[${value.length} items]` : "{...}"
    return (
      <details className="group inline-block text-left">
        <summary className="cursor-pointer select-none text-stone-600 underline decoration-dotted underline-offset-2">
          {summary}
        </summary>
        <pre className="mt-2 whitespace-pre-wrap wrap-break-word rounded-md bg-white/60 p-2 text-xs text-stone-700">
          {safeJsonStringify(value)}
        </pre>
      </details>
    )
  }
  const stringValue = stringifyPrimitive(value)
  const display = typeof value === "string" ? normalizeTextDisplay(stringValue) : stringValue
  return (
    <div className={cn(CLAMP_2, "wrap-break-word")} title={String(display)}>
      {display}
    </div>
  )
}