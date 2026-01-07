import * as React from "react";

import { Button } from "@/components/atoms/button";
import { cn, shortKey } from "@/lib/utils";

type Item = { label: string; value: string };

type Pivot = {
  columns: string[];
  sections: Array<{ title: string; rows: Array<{ id: string; displayKey: string; values: Record<string, string> }> }>;
  fallbackRows: Array<{ id: string; displayKey: string; value: string }>;
  isPivoted: boolean;
};

const CREDIT_COLUMNS = ["TransUnion", "Experian", "Equifax"] as const;
type CreditColumn = (typeof CREDIT_COLUMNS)[number];

function isNegativeValue(value: string) {
  const raw = value.trim();
  if (!raw) return false;

  const normalized = raw
    .replace(/^\(/, "-")
    .replace(/\)$/, "")
    .replace(/[$,%\s]/g, "")
    .replace(/,/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) && n < 0;
}

function isNegativeFieldLabel(label: string) {
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
}

function getSectionTitle(rowKey: string) {
  const idx = rowKey.indexOf(".");
  if (idx === -1) return "Overview";
  return rowKey.slice(0, idx);
}

function getRowLabel(rowKey: string) {
  return rowKey.includes(".") ? rowKey.split(".").pop() ?? rowKey : rowKey;
}

function buildPivot(items: Item[], showFullKeys: boolean): Pivot {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const bureauByNorm = new Map<string, CreditColumn>(
    CREDIT_COLUMNS.map((c) => [normalize(c), c])
  );

  const parseBureauLabel = (label: string): { bureau: CreditColumn; rowKeyRaw: string } | null => {
    const parts = label.split(".").filter(Boolean);
    if (parts.length < 2) return null;

    // Find the bureau segment anywhere in the first few path parts.
    // Handles shapes like:
    // - TransUnion.Accounts.Total
    // - Credit.TransUnion.Accounts.Total
    // - credit.trans_union.Accounts.Total
    const searchLimit = Math.min(parts.length, 4);
    for (let i = 0; i < searchLimit; i++) {
      const bureau = bureauByNorm.get(normalize(parts[i]));
      if (!bureau) continue;
      const rest = parts.slice(i + 1);
      if (rest.length === 0) return null;
      return { bureau, rowKeyRaw: rest.join(".") };
    }

    return null;
  };

  const rowsMap = new Map<string, Record<string, string>>();
  let sawBureau = false;

  for (const it of items) {
    const parsed = parseBureauLabel(it.label);
    if (!parsed) continue;
    sawBureau = true;

    const rowKey = showFullKeys ? parsed.rowKeyRaw : shortKey(parsed.rowKeyRaw);
    const prev = rowsMap.get(rowKey) ?? {};
    prev[parsed.bureau] = it.value;
    rowsMap.set(rowKey, prev);
  }

  if (!sawBureau || rowsMap.size === 0) {
    return {
      columns: [],
      sections: [],
      fallbackRows: items.map((it) => ({
        id: it.label,
        displayKey: showFullKeys ? it.label : shortKey(it.label),
        value: it.value,
      })),
      isPivoted: false,
    };
  }

  const allRows = Array.from(rowsMap.entries())
    .map(([id, values]) => ({
      id,
      displayKey: showFullKeys ? id : shortKey(id),
      values,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const sectionMap = new Map<
    string,
    Array<{ id: string; displayKey: string; values: Record<string, string> }>
  >();
  for (const row of allRows) {
    const section = getSectionTitle(row.id);
    const list = sectionMap.get(section) ?? [];
    list.push(row);
    sectionMap.set(section, list);
  }

  const sections = Array.from(sectionMap.entries())
    .map(([title, rows]) => ({ title, rows }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    columns: [...CREDIT_COLUMNS],
    sections,
    fallbackRows: [],
    isPivoted: true,
  };
}

export function DashboardPreviewTable({
  items,
  showFullKeys,
  onSendToLetter,
}: {
  items: Item[];
  showFullKeys: boolean;
  onSendToLetter?: (item: Item) => void;
}) {
  const pivot = React.useMemo(() => buildPivot(items, showFullKeys), [items, showFullKeys]);

  if (!pivot.isPivoted) {
    return (
      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur">
              <tr>
                <th className="border-b px-3 py-2 text-left font-medium text-foreground">Field</th>
                <th className="border-b px-3 py-2 text-left font-medium text-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {pivot.fallbackRows.map((row) => {
                const negative = isNegativeValue(row.value) || isNegativeFieldLabel(row.id);
                return (
                  <tr key={row.id} className="odd:bg-muted/20">
                    <td className="border-b px-3 py-2 font-mono text-xs text-muted-foreground" title={row.id}>
                      {row.displayKey}
                    </td>
                    <td
                      className={cn(
                        "border-b px-3 py-2 text-foreground",
                        negative ? "border-destructive/40 bg-destructive/5" : null
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 wrap-break-word">{row.value}</div>
                        {negative && onSendToLetter ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onSendToLetter({ label: row.id, value: row.value })}
                          >
                            Send
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="max-h-[420px] overflow-auto">
        {pivot.sections.map((section) => (
          <div key={section.title} className="border-b last:border-b-0">
            <div className="sticky top-0 z-10 border-b bg-background/95 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur">
              {section.title}
            </div>
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-7 bg-muted/60 backdrop-blur">
                <tr>
                  <th className="border-b px-3 py-2 text-left font-medium text-foreground">Field</th>
                  {pivot.columns.map((c) => (
                    <th key={c} className="border-b px-3 py-2 text-left font-medium text-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.id} className="odd:bg-muted/20">
                    <td className="border-b px-3 py-2 text-muted-foreground" title={row.id}>
                      {getRowLabel(row.displayKey)}
                    </td>
                    {pivot.columns.map((c) => {
                      const value = row.values[c] ?? "";
                      const negative = (value && isNegativeValue(value)) || isNegativeFieldLabel(row.id);
                      return (
                        <td
                          key={`${row.id}::${c}`}
                          className={cn(
                            "border-b px-3 py-2 text-foreground",
                            negative ? "border-destructive/40 bg-destructive/5" : null
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 wrap-break-word">{value}</div>
                            {negative && value && onSendToLetter ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onSendToLetter({ label: `${c}.${row.id}`, value })}
                              >
                                Send
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
