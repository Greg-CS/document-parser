import { ExtractedAccount, type ImportedFile } from "@/lib/interfaces/GlobalInterfaces"
import React from "react";
import { Badge } from "@/components/atoms/badge";
import { ACCOUNT_TYPE_CATEGORIES, AccountCategory } from "@/lib/types/Global";
import { cn, extractTrendedDataText, formatDateValue, formatDisplayValue, getCreditComments, getPaymentHistoryTimeline, getRawField, normalizeKey } from "@/lib/utils";
import { Check, X, AlertTriangle, HelpCircle, CalendarX, Send, CheckCircle2, Wallet } from "lucide-react";

import { TransUnionLogo, ExperianLogo, EquifaxLogo } from "@/components/molecules/icons/CreditBureauIcons";
import { Button } from "@/components/atoms/button";
import { AccountCard } from "../Card/AccountCard";
import { TrendedDataSection } from "@/components/organisms/sections/TrendedDataSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/atoms/tabs";
import { Collapsible } from "@/components/atoms/collapsible";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/atoms/popover";
import { getArrayApiCodeDefinition, isArrayApiCode, normalizeArrayApiCode } from "@/lib/arrayapi-codes";

interface AccountTabProp {
  tuFile?: ImportedFile;
  exFile?: ImportedFile;
  eqFile?: ImportedFile;
  showFullKeys: boolean;
  onSendToDispute?: (items: Array<{ label: string; value: string }>) => void;
}

const CATEGORY_SEVERITY: Record<AccountCategory, number> = {
  revolving: 1,
  open: 2,
  installment: 3,
  mortgage: 4,
  inquiry: 5,
  publicrecord: 6,
  derogatory: 7,
  chargeoff: 8,
  collection: 9,
};

const ACCOUNT_ARRAY_PATTERNS = [
  "credit_liability", "creditliability", "tradeline", "account", 
  "credit_account", "creditaccount", "liability", "trade_line"
];

const CATEGORY_PATTERNS: Record<AccountCategory, string[]> = {
  collection: ["collection", "collect", "coll_"],
  chargeoff: ["chargeoff", "charge_off", "charged_off", "chargedoff"],
  derogatory: ["derogatory", "derog", "negative", "adverse"],
  mortgage: ["mortgage", "mtg", "home_loan", "homeloan"],
  installment: ["installment", "install", "auto_loan", "autoloan", "student", "personal_loan"],
  revolving: ["revolving", "credit_card", "creditcard", "card", "visa", "mastercard", "amex", "discover"],
  open: ["open", "heloc", "line_of_credit"],
  inquiry: ["inquiry", "inquir"],
  publicrecord: ["public_record", "publicrecord", "bankruptcy", "judgment", "lien", "foreclosure"],
};

function categorizeAccount(fields: Record<string, unknown>): AccountCategory {
  const isYes = (v: unknown) => {
    const s = String(v ?? "").toUpperCase();
    return s === "Y" || s === "YES" || s === "TRUE" || s === "1";
  };

  const collectionIndicator =
    fields["@IsCollectionIndicator"] ??
    fields["@_IsCollectionIndicator"] ??
    fields["isCollectionIndicator"] ??
    fields["collectionIndicator"];
  if (isYes(collectionIndicator)) return "collection";

  const chargeoffIndicator =
    fields["@IsChargeoffIndicator"] ??
    fields["@_IsChargeoffIndicator"] ??
    fields["isChargeoffIndicator"] ??
    fields["chargeoffIndicator"];
  if (isYes(chargeoffIndicator)) return "chargeoff";

  const derogatoryIndicator =
    fields["@_DerogatoryDataIndicator"] ??
    fields["@DerogatoryDataIndicator"] ??
    fields["derogatoryDataIndicator"];
  if (isYes(derogatoryIndicator) || fields["derogatory"] === true) return "derogatory";
  
  const accountType = String(fields["accountType"] || fields["account_type"] || fields["type"] || "").toLowerCase();
  
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some(p => accountType.includes(p))) {
      return category as AccountCategory;
    }
  }
  
  if (accountType.includes("mortgage") || accountType.includes("mtg")) return "mortgage";
  if (accountType.includes("install") || accountType.includes("auto") || accountType.includes("student")) return "installment";
  if (accountType.includes("revolv") || accountType.includes("card")) return "revolving";
  
  return "revolving"; 
}

function extractAccountsFromData(data: unknown, bureau: "transunion" | "experian" | "equifax"): ExtractedAccount[] {
  if (!data || typeof data !== "object") return [];
  
  const accounts: ExtractedAccount[] = [];
  
  const findAccountArrays = (obj: unknown, path: string): void => {
    if (!obj || typeof obj !== "object") return;
    
    if (Array.isArray(obj)) {
      const normalizedPath = normalizeKey(path);
      const isAccountArray = ACCOUNT_ARRAY_PATTERNS.some(p => normalizedPath.includes(p));
      
      if (isAccountArray && obj.length > 0 && typeof obj[0] === "object") {
        obj.forEach((item, idx) => {
          if (item && typeof item === "object") {
            const fields = item as Record<string, unknown>;
            const creditorObj = fields["_CREDITOR"];
            const creditorName = String(
              fields["creditorName"] || fields["creditor_name"] || 
              fields["subscriberName"] || fields["subscriber_name"] ||
              (typeof creditorObj === "object" && creditorObj !== null
                ? (creditorObj as Record<string, unknown>)["@_Name"]
                : undefined) ||
              fields["@_OriginalCreditorName"] ||
              fields["name"] || fields["@_Name"] || "Unknown"
            );
            const accountNumber = String(
              fields["accountNumber"] || fields["account_number"] ||
              fields["accountIdentifier"] || fields["@_AccountIdentifier"] || ""
            );
            const liabilityIndex = normalizedPath.includes("creditliability") ? idx : undefined;
            
            accounts.push({
              id: `${bureau}-${path}-${idx}`,
              category: categorizeAccount(fields),
              creditorName,
              accountNumber: accountNumber.slice(-4) ? `****${accountNumber.slice(-4)}` : "",
              fields,
              sourceKey: `${path}[${idx}]`,
              index: idx,
              bureau,
              liabilityIndex,
            });
          }
        });
      }
      return;
    }
    
    const record = obj as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      const newPath = path ? `${path}.${key}` : key;
      findAccountArrays(value, newPath);
    }
  };
  
  findAccountArrays(data, "");
  return accounts;
}

function getField(fields: Record<string, unknown>, ...keys: string[]): string {
  const raw = getRawField(fields, ...keys);
  if (raw === undefined || raw === null) return "—";
  return formatDisplayValue(raw);
}

function formatMoneyValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return formatDisplayValue(value);
  if (num >= 999_999_000) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

function getAccountCompareSummary(account?: ExtractedAccount) {
  if (!account) {
    return {
      status: "—",
      dateReported: "—",
      balance: "—",
      creditLimit: "—",
      highCredit: "—",
      accountType: "—",
      owner: "—",
      category: "—",
    };
  }

  const fields = account.fields;
  const status = getField(fields, "accountstatus", "status", "paymentstatus");
  const balance = formatMoneyValue(
    getRawField(
      fields,
      "@_UnpaidBalanceAmount",
      "unpaidbalanceamount",
      "currentbalance",
      "balance",
      "balanceamount",
      "@_OriginalBalanceAmount",
      "originalbalanceamount"
    )
  );
  const creditLimit = formatMoneyValue(
    getRawField(fields, "@_CreditLimitAmount", "creditlimitamount", "creditlimit", "highlimit", "high_credit")
  );
  const highCredit = formatMoneyValue(
    getRawField(
      fields,
      "@_HighCreditAmount",
      "highcreditamount",
      "highcredit",
      "@_HighBalanceAmount",
      "highbalanceamount",
      "highbalance",
      "highest_balance"
    )
  );
  const accountType = getField(fields, "accounttype", "type", "loantype");
  const owner = getField(fields, "owner", "accountowner", "ecoa");
  const dateReported = formatDateValue(
    getRawField(fields, "@_AccountReportedDate", "accountreporteddate", "datereported", "reportdate", "date_reported")
  );
  const category = ACCOUNT_TYPE_CATEGORIES[account.category]?.label ?? "—";

  return { status, dateReported, balance, creditLimit, highCredit, accountType, owner, category };
}

function paymentGridCell(code: string, tone: "ok" | "late" | "bad" | "unknown") {
  // Simplified display: show checkmark for on-time, show code number for late/bad, dash for unknown
  const base = "rounded px-1.5 py-1 text-[11px] font-medium";
  
  if (tone === "ok") {
    return { 
      display: <Check className="w-3.5 h-3.5" />, 
      className: cn(base, "bg-green-100 text-green-700"), 
      tone 
    };
  }
  if (tone === "late") {
    return { 
      display: <span>{code}</span>, 
      className: cn(base, "bg-amber-100 text-amber-700 border border-amber-200"), 
      tone 
    };
  }
  if (tone === "bad") {
    return { 
      display: <span>{code}</span>, 
      className: cn(base, "bg-red-100 text-red-700 border border-red-200"), 
      tone 
    };
  }
  // Unknown - show a simple dash, not confusing icons
  return { 
    display: <span className="text-stone-400">—</span>, 
    className: cn(base, "bg-stone-50 text-stone-400"), 
    tone 
  };
}

function hasMeaningfulPaymentHistory(fields: Record<string, unknown>): boolean {
  const timeline = getPaymentHistoryTimeline(fields);
  return timeline.some((e) => e.tone === "ok" || e.tone === "late" || e.tone === "bad");
}

function PaymentHistorySection({ fields, showEmptyState = false }: { fields: Record<string, unknown>; showEmptyState?: boolean }) {
  const timeline = getPaymentHistoryTimeline(fields);
  
  // Calculate summary stats early to check if we have meaningful data
  const okCount = timeline.filter((e) => e.tone === "ok").length;
  const lateCount = timeline.filter((e) => e.tone === "late").length;
  const badCount = timeline.filter((e) => e.tone === "bad").length;
  const hasMeaningfulData = okCount > 0 || lateCount > 0 || badCount > 0;
  
  // Show empty state when no data OR when all data is "unknown" (no meaningful payment info)
  if (timeline.length === 0 || !hasMeaningfulData) {
    if (!showEmptyState && timeline.length === 0) return null;
    return (
      <div className="mt-4">
        <div className="text-xs font-semibold text-stone-600 mb-2 flex items-center gap-1.5">
          <CalendarX className="w-4 h-4" />
          Payment History
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-6 text-center">
          <CalendarX className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-700 font-medium">No Payment History Available</p>
          <p className="text-xs text-stone-500 mt-1.5 max-w-xs mx-auto">
            This account does not have payment history data reported by the credit bureau.
          </p>
        </div>
      </div>
    );
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = Array.from(new Set(timeline.map((e) => Number(e.month.slice(0, 4)))))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => b - a);
  const byMonth = new Map(timeline.map((e) => [e.month, e] as const));

  const legendItems = (() => {
    const map = new Map<string, { code: string; label: string; tone: "ok" | "late" | "bad" | "unknown" }>();
    for (const e of timeline) {
      const code = String(e.code ?? "").trim();
      if (!code) continue;
      if (!map.has(code)) map.set(code, { code, label: e.label, tone: e.tone });
    }
    const preferred = ["8", "0", "9", "X", "*", "C", "#", "1", "2", "3", "4", "5", "6", "7"];
    const rank = new Map(preferred.map((c, i) => [c, i] as const));
    return Array.from(map.values()).sort((a, b) => {
      const ra = rank.get(a.code) ?? 999;
      const rb = rank.get(b.code) ?? 999;
      if (ra !== rb) return ra - rb;
      return a.code.localeCompare(b.code);
    });
  })();

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
          24-Month Payment History
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-green-700">
            <Check className="w-3 h-3" /> {okCount} on-time
          </span>
          {lateCount > 0 && (
            <span className="flex items-center gap-1 text-amber-700">
              <AlertTriangle className="w-3 h-3" /> {lateCount} late
            </span>
          )}
          {badCount > 0 && (
            <span className="flex items-center gap-1 text-red-700">
              <X className="w-3 h-3" /> {badCount} missed
            </span>
          )}
        </div>
      </div>

      {legendItems.length > 0 ? (
        <div className="mb-3 rounded-lg border border-stone-200 bg-white px-3 py-2">
          <div className="text-[11px] font-semibold text-stone-600 mb-2">Legend</div>
          <div className="flex flex-wrap gap-3">
            {legendItems.filter(item => item.tone !== 'unknown').map((item) => {
              const cell = paymentGridCell(item.code, item.tone);
              return (
                <div
                  key={item.code}
                  className="flex items-center gap-1.5"
                  title={`${item.code}: ${item.label}`}
                >
                  <span className={cn("inline-flex items-center justify-center min-w-[24px] h-6", cell.className)}>
                    {cell.display}
                  </span>
                  <span className="text-[11px] text-stone-600">{item.label}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded px-1.5 py-1 bg-stone-50 text-stone-400 text-[11px]">—</span>
              <span className="text-[11px] text-stone-600">No Data</span>
            </div>
          </div>
        </div>
      ) : null}

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
                    <td
                      key={key}
                      className="px-1 py-1.5 text-center"
                      title={`${entry.month}: ${entry.label}`}
                    >
                      <span
                        className={cn(
                          "inline-flex min-w-[28px] h-6 items-center justify-center",
                          cell.className
                        )}
                      >
                        {cell.display}
                      </span>
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

function ArrayApiCodeLegend({
  codes,
  contextAccount,
}: {
  codes: string[];
  contextAccount?: ExtractedAccount;
}) {
  if (codes.length === 0) return null;

  const unique = Array.from(new Set(codes.map((c) => normalizeArrayApiCode(c)).filter(Boolean)));
  const entries = unique
    .map((code) => ({ code, def: getArrayApiCodeDefinition(code) }))
    .filter((x): x is { code: string; def: NonNullable<ReturnType<typeof getArrayApiCodeDefinition>> } => Boolean(x.def));

  if (entries.length === 0) return null;

  const negative = entries.filter((e) => e.def.category === "negative");
  const positive = entries.filter((e) => e.def.category === "positive");

  const renderGroup = (
    title: string,
    items: Array<{ code: string; def: NonNullable<ReturnType<typeof getArrayApiCodeDefinition>> }>
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-stone-700">{title}</div>
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.code} className="flex items-start gap-2 text-xs">
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 mt-0.5",
                  item.def.category === "negative"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-green-50 text-green-700 border-green-200"
                )}
              >
                {item.code}
              </Badge>
              <div className="text-stone-700">{formatArrayApiCodeText(item.def.text, contextAccount)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <details className="rounded border border-stone-200 bg-white px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-stone-700">
        Code legend ({entries.length})
      </summary>
      <div className="mt-3 space-y-4">
        {renderGroup("Negative account codes", negative)}
        {renderGroup("Positive account codes", positive)}
      </div>
    </details>
  );
}

function formatArrayApiCodeText(text: string, contextAccount?: ExtractedAccount): string {
  if (!contextAccount) return text;

  const rawType = String(
    getRawField(
      contextAccount.fields,
      "@_AccountType",
      "accounttype",
      "account_type",
      "type",
      "loanType",
      "loantype"
    ) ?? ""
  ).toLowerCase();

  const looksLikeStudentLoan =
    contextAccount.category === "installment" || rawType.includes("student");

  if (looksLikeStudentLoan) return text;

  // Some Array API codes are loan-type-specific at the score model level.
  // When showing codes in an account-level UI, soften mismatched wording.
  return text
    .replace(/your student loan accounts/gi, "your accounts")
    .replace(/student loan accounts/gi, "accounts")
    .replace(/student loan/gi, "loan");
}

type StatusFilter = "all" | "positive" | "negative";

const NEGATIVE_ACCOUNT_CATEGORIES = new Set<AccountCategory>([
  "collection",
  "chargeoff",
  "derogatory",
  "publicrecord",
]);

export function AccountsTab({ tuFile, exFile, eqFile, showFullKeys, onSendToDispute }: AccountTabProp) {
  const [accountTypeFilter, setAccountTypeFilter] = React.useState<"all" | AccountCategory>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

  const allAccounts = React.useMemo(() => {
    const accounts: ExtractedAccount[] = [];

    if (tuFile?.data) accounts.push(...extractAccountsFromData(tuFile.data, "transunion"));
    if (exFile?.data) accounts.push(...extractAccountsFromData(exFile.data, "experian"));
    if (eqFile?.data) accounts.push(...extractAccountsFromData(eqFile.data, "equifax"));

    return accounts;
  }, [tuFile, exFile, eqFile]);

  const isAccountNegative = React.useCallback(
    (acc: ExtractedAccount) => {
      if (NEGATIVE_ACCOUNT_CATEGORIES.has(acc.category)) return true;
      return false;
    },
    []
  );

  const accountsByCategory = React.useMemo(() => {
    const groups: Record<AccountCategory, ExtractedAccount[]> = {
      revolving: [],
      installment: [],
      mortgage: [],
      open: [],
      collection: [],
      chargeoff: [],
      derogatory: [],
      inquiry: [],
      publicrecord: [],
    };

    for (const account of allAccounts) groups[account.category].push(account);
    return groups;
  }, [allAccounts]);

  const categoryOptions = (Object.keys(accountsByCategory) as AccountCategory[]).filter(
    (cat) => accountsByCategory[cat].length > 0
  );

  const sortedAccounts = React.useMemo(() => {
    return [...allAccounts].sort((a, b) => CATEGORY_SEVERITY[a.category] - CATEGORY_SEVERITY[b.category]);
  }, [allAccounts]);

  const { positiveCount, negativeCount } = React.useMemo(() => {
    let positive = 0;
    let negative = 0;
    for (const acc of allAccounts) {
      if (isAccountNegative(acc)) negative++;
      else positive++;
    }
    return { positiveCount: positive, negativeCount: negative };
  }, [allAccounts, isAccountNegative]);

  const filteredAccounts = React.useMemo(() => {
    let filtered = sortedAccounts;

    // Apply category filter first (if set)
    if (accountTypeFilter !== "all") {
      filtered = filtered.filter((acc) => acc.category === accountTypeFilter);
      // When a specific category is selected, don't apply status filter
      // (e.g., selecting "Collection" shouldn't also require "positive" status)
      return filtered;
    }

    // Only apply status filter when viewing "all" categories
    if (statusFilter === "positive") {
      filtered = filtered.filter((acc) => !isAccountNegative(acc));
    } else if (statusFilter === "negative") {
      filtered = filtered.filter((acc) => isAccountNegative(acc));
    }

    return filtered;
  }, [sortedAccounts, accountTypeFilter, statusFilter, isAccountNegative]);

  const groupedAccounts = React.useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        creditorName: string;
        accountIdentifier: string;
        accounts: {
          transunion?: ExtractedAccount;
          experian?: ExtractedAccount;
          equifax?: ExtractedAccount;
        };
      }
    >();

    for (const acc of filteredAccounts) {
      const creditorName = acc.creditorName || "Unknown";
      const accountIdentifier =
        String(
          getRawField(acc.fields, "@_AccountIdentifier", "accountidentifier", "accountNumber", "account_number") ?? ""
        ).trim() || acc.accountNumber || "";

      const key = `${normalizeKey(creditorName)}|${normalizeKey(accountIdentifier)}`;
      const existing = map.get(key);
      if (existing) {
        existing.accounts[acc.bureau] = acc;
      } else {
        map.set(key, {
          key,
          creditorName,
          accountIdentifier,
          accounts: { [acc.bureau]: acc },
        });
      }
    }

    const groups = Array.from(map.values());
    const worstSeverity = (g: (typeof groups)[number]) => {
      const present = Object.values(g.accounts).filter(Boolean) as ExtractedAccount[];
      return present.reduce((m, a) => Math.max(m, CATEGORY_SEVERITY[a.category] ?? 0), 0);
    };

    return groups.sort((a, b) => {
      const wa = worstSeverity(a);
      const wb = worstSeverity(b);
      if (wa !== wb) return wb - wa;
      return a.creditorName.localeCompare(b.creditorName);
    });
  }, [filteredAccounts]);

  if (allAccounts.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200/80 bg-amber-50 p-6 text-center">
        <p className="text-stone-600 text-sm">No accounts/tradelines found in the report data</p>
        <p className="text-stone-500 text-xs mt-1">Looking for arrays containing account information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Reassuring, outcome-focused */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Your Credit Accounts</h2>
        <p className="text-sm text-slate-500 mt-1">
          {negativeCount > 0 
            ? `We found ${negativeCount} item${negativeCount !== 1 ? 's' : ''} that may be worth reviewing for accuracy.`
            : 'All accounts appear to be reporting accurately.'
          }
        </p>
      </div>

      {/* Guided Summary - Show what matters most */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Items to Review - Primary action path */}
        {negativeCount > 0 && (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'negative' ? 'all' : 'negative')}
            className={cn(
              "rounded-xl border-2 p-5 text-left transition-all",
              statusFilter === 'negative'
                ? "bg-amber-50 border-amber-400 shadow-md"
                : "bg-white border-amber-200 hover:border-amber-300 hover:shadow-sm"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-amber-700">Items to Review</div>
                <div className="text-3xl font-bold text-amber-600 mt-1">{negativeCount}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">May contain inaccuracies you can dispute</p>
          </button>
        )}

        {/* Good Standing */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'positive' ? 'all' : 'positive')}
          className={cn(
            "rounded-xl border p-5 text-left transition-all",
            statusFilter === 'positive'
              ? "bg-green-50 border-green-300 shadow-md"
              : "bg-white border-slate-200 hover:border-green-200 hover:shadow-sm"
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-green-700">In Good Standing</div>
              <div className="text-3xl font-bold text-green-600 mt-1">{positiveCount}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Reporting correctly across bureaus</p>
        </button>

        {/* Total Overview */}
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={cn(
            "rounded-xl border p-5 text-left transition-all",
            statusFilter === 'all' && negativeCount > 0
              ? "bg-slate-50 border-slate-300 shadow-md"
              : statusFilter === 'all'
              ? "bg-slate-900 border-slate-900 text-white shadow-md"
              : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className={cn("text-sm font-medium", statusFilter === 'all' && negativeCount === 0 ? "text-slate-300" : "text-slate-600")}>Total Accounts</div>
              <div className={cn("text-3xl font-bold mt-1", statusFilter === 'all' && negativeCount === 0 ? "text-white" : "text-slate-900")}>{allAccounts.length}</div>
            </div>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", statusFilter === 'all' && negativeCount === 0 ? "bg-slate-700" : "bg-slate-100")}>
              <Wallet className={cn("w-5 h-5", statusFilter === 'all' && negativeCount === 0 ? "text-slate-300" : "text-slate-600")} />
            </div>
          </div>
          <p className={cn("text-xs mt-2", statusFilter === 'all' && negativeCount === 0 ? "text-slate-400" : "text-slate-500")}>From {groupedAccounts.length} creditors</p>
        </button>
      </div>

      {/* Simplified Filter - Only show if user wants to drill down */}
      {accountTypeFilter !== 'all' || categoryOptions.length > 3 ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500">Filter by type:</span>
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value as "all" | AccountCategory)}
          >
            <option value="all">All account types</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {ACCOUNT_TYPE_CATEGORIES[cat].label} ({accountsByCategory[cat].length})
              </option>
            ))}
          </select>
          {accountTypeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setAccountTypeFilter('all')}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : null}

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
        {groupedAccounts.map((group) => {
          const tu = getAccountCompareSummary(group.accounts.transunion);
          const ex = getAccountCompareSummary(group.accounts.experian);
          const eq = getAccountCompareSummary(group.accounts.equifax);

          const present = [
            group.accounts.transunion,
            group.accounts.experian,
            group.accounts.equifax,
          ].filter(Boolean) as ExtractedAccount[];

          const worstCategory = present.reduce<AccountCategory | null>((worst, a) => {
            if (!worst) return a.category;
            if (CATEGORY_SEVERITY[a.category] > CATEGORY_SEVERITY[worst]) return a.category;
            return worst;
          }, null);

          const anyNegative = present.some((a) => isAccountNegative(a));

          const row = (label: string, a: string, b: string, c: string) => {
            const values = [a, b, c].filter((v) => v !== "—");
            const hasDiscrepancy = values.length > 1 && !values.every((v) => v === values[0]);
            const bureauValues = [
              { name: "TransUnion", value: a },
              { name: "Experian", value: b },
              { name: "Equifax", value: c },
            ].filter((bv) => bv.value !== "—");

            const handleSendToDispute = () => {
              if (!onSendToDispute) return;
              const valuesSummary = bureauValues.map((bv) => `${bv.name}: ${bv.value}`).join(", ");
              onSendToDispute([{
                label: `${group.creditorName} - ${label} discrepancy`,
                value: `Bureaus report different values for ${label}. ${valuesSummary}`,
              }]);
            };

            const renderCell = (val: string, idx: number) => {
              if (!hasDiscrepancy || val === "—") {
                return (
                  <td
                    key={idx}
                    className={cn(
                      "py-2 px-3 text-center text-xs text-stone-700",
                      idx < 2 && "border-r border-amber-200/80"
                    )}
                  >
                    {val}
                  </td>
                );
              }

              return (
                <td
                  key={idx}
                  className={cn(
                    "py-2 px-3 text-center text-xs text-stone-700 bg-amber-200/20",
                    idx < 2 && "border-r border-amber-200/80"
                  )}
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="hover:text-purple-700 hover:underline transition-colors cursor-pointer"
                      >
                        {val}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="center">
                      <div className="space-y-3">
                        <div className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Bureau Discrepancy: {label}
                        </div>
                        <div className="space-y-1.5">
                          {bureauValues.map((bv) => (
                            <div
                              key={bv.name}
                              className={cn(
                                "px-2 py-1.5 rounded border text-xs",
                                bv.value === val
                                  ? "bg-purple-50 border-purple-300 text-purple-800"
                                  : "bg-white border-stone-200 text-stone-700"
                              )}
                            >
                              <span className="font-medium">{bv.name}:</span> {bv.value}
                            </div>
                          ))}
                        </div>
                        {onSendToDispute && (
                          <Button
                            type="button"
                            size="sm"
                            className="w-full h-7 text-xs gap-1"
                            onClick={handleSendToDispute}
                          >
                            <Send className="w-3 h-3" />
                            Send to Dispute
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </td>
              );
            };

            return (
              <tr className={cn("hover:bg-amber-50/40", hasDiscrepancy && "bg-amber-100/30")}>
                <td className="py-2 px-3 text-left text-xs font-medium text-stone-600 w-[200px] border-r border-amber-200/80">
                  <div className="flex items-center gap-1">
                    {label}
                    {hasDiscrepancy && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                  </div>
                </td>
                {renderCell(a, 0)}
                {renderCell(b, 1)}
                {renderCell(c, 2)}
              </tr>
            );
          };

          const available = (["transunion", "experian", "equifax"] as const)
            .map((bureau) => ({ bureau, account: group.accounts[bureau] }))
            .filter(
              (x): x is { bureau: "transunion" | "experian" | "equifax"; account: ExtractedAccount } =>
                Boolean(x.account)
            );

          if (available.length === 0) return null;

          const paymentSource = present.find((a) => hasMeaningfulPaymentHistory(a.fields));
          const trendedSource = present.find((a) => {
            const comments = getCreditComments(a.fields);
            return Boolean(extractTrendedDataText(comments));
          });

          const arrayApiCodesUsed = Array.from(
            new Set(
              present
                .flatMap((a) => getCreditComments(a.fields))
                .map((c) => normalizeArrayApiCode(c.code ?? ""))
                .filter((code) => Boolean(code) && isArrayApiCode(code))
            )
          ).sort((a, b) => a.localeCompare(b));

          const hasInsights = arrayApiCodesUsed.length > 0 || Boolean(trendedSource);

          return (
            <div
              key={group.key}
              className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm"
            >
              <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-stone-800 truncate">{group.creditorName}</div>
                  <div className="text-xs text-stone-500 truncate">
                    Account ID: <span className="font-medium text-stone-700">{group.accountIdentifier || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {worstCategory ? (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", ACCOUNT_TYPE_CATEGORIES[worstCategory].color)}
                    >
                      {ACCOUNT_TYPE_CATEGORIES[worstCategory].label}
                    </Badge>
                  ) : null}
                  {anyNegative ? (
                    <Badge className="bg-red-600 text-white text-xs">Negative</Badge>
                  ) : (
                    <Badge className="bg-green-600 text-white text-xs">Positive</Badge>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-amber-200/80 bg-amber-100/50">
                      <th className="py-3 px-3 text-left text-sm font-medium text-stone-600 w-[200px] border-r border-amber-200/80">
                        Field
                      </th>
                      <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[180px]">
                        <TransUnionLogo />
                      </th>
                      <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[180px]">
                        <ExperianLogo />
                      </th>
                      <th className="py-3 px-3 text-center w-[180px]">
                        <EquifaxLogo />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200/60">
                    {row("Status", tu.status, ex.status, eq.status)}
                    {row("Date Reported", tu.dateReported, ex.dateReported, eq.dateReported)}
                    {row("Balance", tu.balance, ex.balance, eq.balance)}
                    {row("Credit Limit", tu.creditLimit, ex.creditLimit, eq.creditLimit)}
                    {row("High Credit", tu.highCredit, ex.highCredit, eq.highCredit)}
                    {row("Account Type", tu.accountType, ex.accountType, eq.accountType)}
                    {row("Owner", tu.owner, ex.owner, eq.owner)}
                    {row("Category", tu.category, ex.category, eq.category)}
                  </tbody>
                </table>
              </div>

              <div className="p-4 space-y-3">
                <Collapsible 
                  title="Account Details" 
                  defaultOpen={true}
                  badge={<Badge variant="outline" className="text-[10px]">{available.length} bureau{available.length > 1 ? 's' : ''}</Badge>}
                >
                  {available.length === 1 ? (
                    <AccountCard
                      account={available[0].account}
                      showFullKeys={showFullKeys}
                      isNegative={isAccountNegative(available[0].account)}
                      showHeader={false}
                      inGrid={true}
                    />
                  ) : (
                    <Tabs defaultValue={available[0].bureau} className="w-full">
                      <TabsList className="bg-amber-100/50 border border-amber-200/80">
                        {available.map(({ bureau }) => (
                          <TabsTrigger key={bureau} value={bureau} className="text-xs">
                            {bureau === "transunion"
                              ? "TransUnion"
                              : bureau === "experian"
                                ? "Experian"
                                : "Equifax"}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {available.map(({ bureau, account }) => (
                        <TabsContent key={bureau} value={bureau} className="m-0 mt-3">
                          <AccountCard
                            account={account}
                            showFullKeys={showFullKeys}
                            isNegative={isAccountNegative(account)}
                            showHeader={false}
                            inGrid={true}
                          />
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </Collapsible>

                <Collapsible 
                  title="Payment History & Trends" 
                  defaultOpen={false}
                  badge={
                    paymentSource ? (
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">
                        Available
                      </Badge>
                    ) : hasInsights ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">
                        Insights
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-stone-50 text-stone-600">
                        Not reported
                      </Badge>
                    )
                  }
                >
                  {arrayApiCodesUsed.length > 0 ? (
                    <div className="mb-4">
                      <ArrayApiCodeLegend codes={arrayApiCodesUsed} contextAccount={present[0]} />
                    </div>
                  ) : null}
                  {!paymentSource && hasInsights ? (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Payment history was not reported for this account. The insights below come from other bureau-reported fields and scoring codes.
                    </div>
                  ) : null}
                  {paymentSource ? (
                    <PaymentHistorySection fields={paymentSource.fields} showEmptyState={true} />
                  ) : (
                    <PaymentHistorySection fields={{}} showEmptyState={true} />
                  )}
                  {trendedSource ? <TrendedDataSection fields={trendedSource.fields} /> : null}
                </Collapsible>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}