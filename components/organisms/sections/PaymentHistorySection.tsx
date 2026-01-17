import { cn, getPaymentHistoryTimeline, paymentGridCell } from "@/lib/utils";

export function PaymentHistorySection({ fields }: { fields: Record<string, unknown> }) {
  const timeline = getPaymentHistoryTimeline(fields);
  if (timeline.length === 0) return null;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = Array.from(new Set(timeline.map((e) => Number(e.month.slice(0, 4)))))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => b - a);
  const byMonth = new Map(timeline.map((e) => [e.month, e] as const));

  return (
    <div className="mt-4">
      <div className="text-xs font-semibold text-red-700 mb-2">Payment History</div>
      <div className="overflow-x-auto rounded border border-stone-200">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="px-2 py-2 text-left font-medium text-stone-600 w-[70px]">Year</th>
              {months.map((m) => (
                <th key={m} className="px-2 py-2 text-center font-medium text-stone-600">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 bg-white">
            {years.map((y) => (
              <tr key={y} className="hover:bg-stone-50/50">
                <td className="px-2 py-2 font-medium text-stone-700">{y}</td>
                {months.map((_, idx) => {
                  const key = `${y}-${String(idx + 1).padStart(2, "0")}`;
                  const entry = byMonth.get(key);
                  if (!entry) return <td key={key} className="px-2 py-2 text-center text-stone-300">—</td>;
                  const cell = paymentGridCell(entry.code, entry.tone);
                  return (
                    <td key={key} className="px-2 py-2 text-center" title={`${entry.month}: ${entry.label} (code ${entry.code})`}>
                      <span className={cn("inline-block min-w-[18px]", cell.className)}>{cell.text || ""}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}