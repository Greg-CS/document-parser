import * as React from "react";

import { cn } from "@/lib/utils";

export function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Record<string, string>>;
}) {
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

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="border-b px-3 py-2 text-left font-medium text-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="odd:bg-muted/20">
                {columns.map((c) => (
                  <td
                    key={c}
                    className={cn(
                      "border-b px-3 py-2 text-foreground",
                      (row[c] && isNegativeValue(row[c])) || isNegativeFieldLabel(c)
                        ? "border-destructive/40 bg-destructive/5"
                        : null
                    )}
                  >
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
