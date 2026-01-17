import { extractTrendedDataText, formatDateValue, formatMoneyValue, getCreditComments } from "@/lib/utils";

type TrendRow = {
  month: string;
  balance?: string;
  scheduledPayment?: string;
  actualPayment?: string;
  lastPaymentDate?: string;
  pastDue?: string;
  highCredit?: string;
  creditLimit?: string;
  comment1?: string;
  comment2?: string;
};

function parseTrendRowsFromText(text: string): TrendRow[] {
  const rows: TrendRow[] = [];
  const xmlish = text.match(/<\s*TrendedData[\s\S]*?<\s*\/\s*TrendedData\s*>/i)?.[0] ?? text;

  const tagMatches = Array.from(xmlish.matchAll(/<\s*([A-Za-z0-9_:-]+)\b([^>]*)\/?\s*>/g));
  for (const m of tagMatches) {
    const attrsRaw = m[2] ?? "";
    if (!/month|year/i.test(attrsRaw)) continue;

    const attrs: Record<string, string> = {};
    for (const a of attrsRaw.matchAll(/([A-Za-z0-9_:-]+)\s*=\s*"([^"]*)"/g)) {
      attrs[a[1].toLowerCase()] = a[2];
    }

    const directMonth = (attrs["month"] ?? "").trim();
    let month = "";
    if (/^\d{4}-\d{2}$/.test(directMonth)) {
      month = directMonth;
    } else {
      const year = (attrs["year"] ?? attrs["yyyy"] ?? "").trim();
      const monthNum = (attrs["mm"] ?? attrs["monthnumber"] ?? attrs["monthnum"] ?? attrs["m"] ?? directMonth).trim();
      const y = Number(year);
      const mn = Number(monthNum);
      if (Number.isFinite(y) && y > 1900 && Number.isFinite(mn) && mn >= 1 && mn <= 12) {
        month = `${y}-${String(mn).padStart(2, "0")}`;
      }
    }
    if (!month) continue;

    rows.push({
      month,
      balance: attrs["balance"] ?? attrs["bal"],
      scheduledPayment: attrs["scheduledpayment"] ?? attrs["scheduled_payment"] ?? attrs["schedpayment"],
      actualPayment: attrs["actualpayment"] ?? attrs["actual_payment"] ?? attrs["payment"],
      lastPaymentDate: attrs["lastpaymentdate"] ?? attrs["last_payment_date"],
      pastDue: attrs["pastdue"] ?? attrs["past_due"] ?? attrs["amountpastdue"],
      highCredit: attrs["highcredit"] ?? attrs["high_credit"],
      creditLimit: attrs["creditlimit"] ?? attrs["credit_limit"],
      comment1: (attrs["comment1"] ?? attrs["narrativecode1"] ?? attrs["commentcode1"] ?? "").trim() || undefined,
      comment2: (attrs["comment2"] ?? attrs["narrativecode2"] ?? attrs["commentcode2"] ?? "").trim() || undefined,
    });
  }

  return rows.sort((a, b) => b.month.localeCompare(a.month));
}

export function TrendedDataSection({ fields }: { fields: Record<string, unknown> }) {
  const comments = getCreditComments(fields);
  const trendedText = extractTrendedDataText(comments);
  if (!trendedText) return null;
  const rows = parseTrendRowsFromText(trendedText).slice(0, 24);
  if (rows.length === 0) return null;

  const codeToText = new Map<string, string>();
  for (const c of comments) {
    const code = (c.code ?? "").trim();
    const txt = (c.text ?? "").trim();
    if (!code || !txt) continue;
    if (!codeToText.has(code)) codeToText.set(code, txt);
  }

  const codesUsed = Array.from(
    new Set(rows.flatMap((r) => [r.comment1, r.comment2].filter(Boolean) as string[]))
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="mt-4 space-y-4">
      <div>
        <div className="text-xs font-semibold text-stone-700 mb-2">24 Month History</div>
        <div className="overflow-x-auto rounded border border-stone-200">
          <table className="w-full min-w-[980px] text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-2 py-2 text-left font-medium text-stone-600">Month</th>
                <th className="px-2 py-2 text-right font-medium text-stone-600">Balance</th>
                <th className="px-2 py-2 text-right font-medium text-stone-600">Scheduled Payment</th>
                <th className="px-2 py-2 text-right font-medium text-stone-600">Actual Payment</th>
                <th className="px-2 py-2 text-left font-medium text-stone-600">Last Payment Date</th>
                <th className="px-2 py-2 text-right font-medium text-stone-600">Past Due</th>
                <th className="px-2 py-2 text-right font-medium text-stone-600">High Credit</th>
                <th className="px-2 py-2 text-right font-medium text-stone-600">Credit Limit</th>
                <th className="px-2 py-2 text-left font-medium text-stone-600">Narrative Codes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {rows.map((r) => {
                const narrative = [r.comment1, r.comment2].filter(Boolean).join(", ") || "—";
                return (
                  <tr key={r.month} className="hover:bg-stone-50/50">
                    <td className="px-2 py-2 font-medium text-stone-700">{r.month}</td>
                    <td className="px-2 py-2 text-right text-stone-700">{formatMoneyValue(r.balance)}</td>
                    <td className="px-2 py-2 text-right text-stone-700">{formatMoneyValue(r.scheduledPayment)}</td>
                    <td className="px-2 py-2 text-right text-stone-700">{formatMoneyValue(r.actualPayment)}</td>
                    <td className="px-2 py-2 text-stone-700">{formatDateValue(r.lastPaymentDate)}</td>
                    <td className="px-2 py-2 text-right text-stone-700">{formatMoneyValue(r.pastDue)}</td>
                    <td className="px-2 py-2 text-right text-stone-700">{formatMoneyValue(r.highCredit)}</td>
                    <td className="px-2 py-2 text-right text-stone-700">{formatMoneyValue(r.creditLimit)}</td>
                    <td className="px-2 py-2 text-stone-700">{narrative}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {codesUsed.length > 0 ? (
        <div>
          <div className="text-xs font-semibold text-stone-700 mb-2">Narrative Code</div>
          <div className="text-xs text-stone-600 mb-2">{codesUsed.join(", ")}</div>
          <div className="overflow-x-auto rounded border border-stone-200">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-2 py-2 text-left font-medium text-stone-600 w-[140px]">Narrative Code</th>
                  <th className="px-2 py-2 text-left font-medium text-stone-600">Narrative Code Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                {codesUsed.map((code) => (
                  <tr key={code} className="hover:bg-stone-50/50">
                    <td className="px-2 py-2 font-medium text-stone-700">{code}</td>
                    <td className="px-2 py-2 text-stone-700">{codeToText.get(code) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}