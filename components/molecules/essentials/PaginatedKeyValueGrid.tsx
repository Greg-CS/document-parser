import * as React from "react";

import { Button } from "@/components/atoms/button";
import { cn, shortKey } from "@/lib/utils";

export function PaginatedKeyValueGrid({
  items,
  page,
  pageSize,
  showFullKeys,
  onPageChange,
  onPageSizeChange,
  onToggleShowFullKeys,
  onSendToLetter,
}: {
  items: Array<{ label: string; value: string }>;
  page: number;
  pageSize: number;
  showFullKeys: boolean;
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
  onToggleShowFullKeys: () => void;
  onSendToLetter?: (item: { label: string; value: string }) => void;
}) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);

  const [contextLabel, setContextLabel] = React.useState<string | null>(null);
  const contextOpen = contextLabel !== null;

  const isNegativeValue = (value: string) => {
    const raw = value.trim();
    if (!raw) return false;

    const normalized = raw
      .replace(/^\(/, "-")
      .replace(/\)$/, "")
      .replace(/[$,%\s]/g, "")
      .replace(/,/g, "");

    const n = Number(normalized);
    return Number.isFinite(n) && n < 0;
  };

  const isNegativeFieldLabel = (label: string) => {
    const normalized = label.toLowerCase().replace(/[^a-z0-9]/g, "");
    const keywords = [
      "unpaid",
      "unpaidbalance",
      "unpaidbalanceamount",
      "balance",
      "amountdue",
      "paymentdue",
      "pastdue",
      "overdue",
      "delinquent",
      "latepayment",
      "chargeoff",
      "collections",
      "collection",
      "liability",
      "debt",
      "owed",
      "default",
    ];

    return keywords.some((k) => normalized.includes(k));
  };

  const isNegativeItem = (label: string, value: string) =>
    isNegativeValue(value) || isNegativeFieldLabel(label);

  const getParentPath = (label: string) => {
    const idx = label.lastIndexOf(".");
    if (idx === -1) return "";
    return label.slice(0, idx);
  };

  const contextItem = React.useMemo(() => {
    if (!contextLabel) return null;
    return items.find((i) => i.label === contextLabel) ?? null;
  }, [contextLabel, items]);

  const relatedItems = React.useMemo(() => {
    if (!contextItem) return [];
    const parent = getParentPath(contextItem.label);
    if (!parent) return [];
    return items
      .filter((i) => i.label !== contextItem.label && getParentPath(i.label) === parent)
      .slice(0, 50);
  }, [contextItem, items]);

  return (
    <div className="space-y-3">
      {contextOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setContextLabel(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setContextLabel(null);
          }}
          tabIndex={-1}
        >
          <div className="w-full max-w-2xl rounded-xl border bg-background shadow-lg">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">Negative item context</div>
                <div className="mt-1 truncate text-xs text-muted-foreground" title={contextItem?.label ?? ""}>
                  {contextItem?.label ?? ""}
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setContextLabel(null)}>
                Close
              </Button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="rounded-lg border bg-background px-3 py-3">
                <div className="text-xs font-medium text-muted-foreground">Value</div>
                <div className="mt-1 wrap-break-word text-sm font-medium text-foreground">
                  {contextItem?.value ?? ""}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground">Related fields</div>
                {relatedItems.length === 0 ? (
                  <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                    No related fields found for this path.
                  </div>
                ) : (
                  <div className="mt-2 max-h-[340px] overflow-auto rounded-lg border">
                    <div className="divide-y">
                      {relatedItems.map((item) => (
                        <div key={item.label} className="flex flex-col gap-1 px-3 py-2">
                          <div className="truncate text-xs font-medium text-muted-foreground" title={item.label}>
                            {item.label}
                          </div>
                          <div className="wrap-break-word text-sm text-foreground">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Showing {total === 0 ? 0 : start + 1}–{Math.min(start + pageSize, total)} of {total}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onToggleShowFullKeys}
          >
            {showFullKeys ? "Full keys" : "Short keys"}
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Per page</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {[6, 12, 24, 48].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
            >
              Prev
            </Button>
            <div className="text-xs text-muted-foreground">
              Page {safePage} / {totalPages}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {slice.map((item) => {
          const displayKey = showFullKeys ? item.label : shortKey(item.label);
          const isNegative = isNegativeItem(item.label, item.value);
          return (
            <div
              key={item.label}
              className={cn(
                "rounded-lg border bg-background px-4 py-3",
                isNegative ? "border-destructive/40 bg-destructive/5" : null
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="min-w-0 truncate text-xs font-medium text-muted-foreground"
                  title={item.label}
                >
                  {displayKey}
                </div>

                {isNegative ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {onSendToLetter ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onSendToLetter({ label: item.label, value: item.value })}
                      >
                        Send to letter
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setContextLabel(item.label)}
                    >
                      View context
                    </Button>
                  </div>
                ) : null}
              </div>
              <div
                className="mt-1 truncate text-sm font-medium text-foreground"
                title={item.value}
              >
                {item.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
