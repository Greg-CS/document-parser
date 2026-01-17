import { ExtractedAccount, type ImportedFile } from "@/lib/interfaces/GlobalInterfaces"
import React from "react";
import { Badge } from "@/components/atoms/badge";
import { ACCOUNT_TYPE_CATEGORIES, AccountCategory } from "@/lib/types/Global";
import { cn, extractTrendedDataText, formatDateValue, formatDisplayValue, getCreditComments, getPaymentHistoryTimeline, getRawField, normalizeKey, shortKey } from "@/lib/utils";
import { TransUnionLogo, ExperianLogo, EquifaxLogo } from "@/components/molecules/icons/CreditBureauIcons";
import { Button } from "@/components/atoms/button";
import {
  DisputeItem,
  generateDisputeReason,
  getDisputeSeverity,
  getFieldCategory,
  isNegativeValue,
  shouldSurfaceDisputeItem,
} from "@/lib/dispute-fields";
import { AccountCard } from "../Card/AccountCard";
import { DisputeItemsPane } from "../TableAssets/DisputeItemsPane";
import { TrendedDataSection } from "@/components/organisms/sections/TrendedDataSection";

interface AccountTabProp {
  tuFile?: ImportedFile;
  exFile?: ImportedFile;
  eqFile?: ImportedFile;
  showFullKeys: boolean;
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void;
}

// Severity order: least important (0) to most important (highest number)
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

// Patterns to identify account/tradeline arrays in the data
const ACCOUNT_ARRAY_PATTERNS = [
  "credit_liability", "creditliability", "tradeline", "account", 
  "credit_account", "creditaccount", "liability", "trade_line"
];

// Patterns to categorize account types
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
  
  // Check account type field
  const accountType = String(fields["accountType"] || fields["account_type"] || fields["type"] || "").toLowerCase();
  
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some(p => accountType.includes(p))) {
      return category as AccountCategory;
    }
  }
  
  // Default based on other indicators
  if (accountType.includes("mortgage") || accountType.includes("mtg")) return "mortgage";
  if (accountType.includes("install") || accountType.includes("auto") || accountType.includes("student")) return "installment";
  if (accountType.includes("revolv") || accountType.includes("card")) return "revolving";
  
  return "revolving"; // Default
}

function extractAccountsFromData(data: unknown, bureau: "transunion" | "experian" | "equifax"): ExtractedAccount[] {
  if (!data || typeof data !== "object") return [];
  
  const accounts: ExtractedAccount[] = [];
  
  const findAccountArrays = (obj: unknown, path: string): void => {
    if (!obj || typeof obj !== "object") return;
    
    if (Array.isArray(obj)) {
      // Check if this array contains account-like objects
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
    
    // Recurse into object properties
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
  const base = "rounded px-1 py-0.5 font-semibold";
  if (tone === "ok") return { text: code, className: cn(base, "bg-green-100 text-green-800") };
  if (tone === "late") return { text: code, className: cn(base, "bg-amber-100 text-amber-800") };
  if (tone === "bad") return { text: code, className: cn(base, "bg-red-100 text-red-800") };
  return { text: code, className: cn(base, "bg-stone-100 text-stone-700") };
}

function PaymentHistorySection({ fields }: { fields: Record<string, unknown> }) {
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

// Define negative categories
type StatusFilter = "all" | "positive" | "negative";

const NEGATIVE_ACCOUNT_CATEGORIES = new Set<AccountCategory>([
  "collection",
  "chargeoff",
  "derogatory",
  "publicrecord",
]);

function collectLeafFieldPaths(
  obj: unknown,
  prefix = ""
): Array<{ fieldPath: string; value: unknown }> {
  if (obj === null || obj === undefined) return [];

  if (Array.isArray(obj)) {
    const out: Array<{ fieldPath: string; value: unknown }> = [];
    for (let i = 0; i < obj.length; i++) {
      const nextPrefix = prefix ? `${prefix}[${i}]` : `[${i}]`;
      out.push(...collectLeafFieldPaths(obj[i], nextPrefix));
    }
    return out;
  }

  if (typeof obj === "object") {
    const out: Array<{ fieldPath: string; value: unknown }> = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const nextPrefix = prefix ? `${prefix}.${k}` : k;
      out.push(...collectLeafFieldPaths(v, nextPrefix));
    }
    return out;
  }

  if (!prefix) return [];
  return [{ fieldPath: prefix, value: obj }];
}

// Accounts Tab Component
export function AccountsTab({ tuFile, exFile, eqFile, showFullKeys, onSendToLetter }: AccountTabProp) {
  const [accountTypeFilter, setAccountTypeFilter] = React.useState<"all" | AccountCategory>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [selectedDisputes, setSelectedDisputes] = React.useState<Set<string>>(new Set());
  const [disputeReasons, setDisputeReasons] = React.useState<Record<string, string[]>>({});

  const allAccounts = React.useMemo(() => {
    const accounts: ExtractedAccount[] = [];

    if (tuFile?.data) accounts.push(...extractAccountsFromData(tuFile.data, "transunion"));
    if (exFile?.data) accounts.push(...extractAccountsFromData(exFile.data, "experian"));
    if (eqFile?.data) accounts.push(...extractAccountsFromData(eqFile.data, "equifax"));

    return accounts;
  }, [tuFile, exFile, eqFile]);

  const accountDisputes = React.useMemo(() => {
    const map = new Map<string, DisputeItem[]>();

    for (const acc of allAccounts) {
      const creditorName = acc.creditorName || "Unknown";
      const accountIdentifier = String(
        getRawField(acc.fields, "@_AccountIdentifier", "accountidentifier", "accountNumber", "account_number") ?? ""
      ).trim();

      const leafFields = collectLeafFieldPaths(acc.fields);
      const disputes: DisputeItem[] = [];

      for (const leaf of leafFields) {
        const fullFieldPath = `${acc.sourceKey}.${leaf.fieldPath}`;
        if (!shouldSurfaceDisputeItem(fullFieldPath)) continue;
        if (!isNegativeValue(fullFieldPath, leaf.value)) continue;

        disputes.push({
          id: `${acc.bureau}-${fullFieldPath}`,
          category: getFieldCategory(fullFieldPath),
          fieldPath: fullFieldPath,
          fieldName: leaf.fieldPath.split(".").pop() || leaf.fieldPath,
          value: leaf.value,
          bureau: acc.bureau,
          severity: getDisputeSeverity(fullFieldPath, leaf.value),
          reason: generateDisputeReason(fullFieldPath, leaf.value),
          accountIdentifier: accountIdentifier || undefined,
          creditorName,
        });
      }

      map.set(acc.id, disputes);
    }

    return map;
  }, [allAccounts]);

  const isAccountNegative = React.useCallback(
    (acc: ExtractedAccount) => {
      if (NEGATIVE_ACCOUNT_CATEGORIES.has(acc.category)) return true;
      return (accountDisputes.get(acc.id) ?? []).length > 0;
    },
    [accountDisputes]
  );

  const toggleDisputeSelection = React.useCallback((id: string) => {
    setSelectedDisputes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sendDisputesToLetter = React.useCallback(
    (itemsToSend: DisputeItem[]) => {
      if (!onSendToLetter || itemsToSend.length === 0) return;
      const items = itemsToSend.map((item) => ({
        label: `${item.creditorName || "Unknown"} - ${(disputeReasons[item.id]?.length ? disputeReasons[item.id].join("; ") : item.reason)}`,
        value: `${shortKey(item.fieldPath)}: ${formatDisplayValue(item.value)}`,
      }));
      onSendToLetter(items);
      setSelectedDisputes(new Set());
    },
    [onSendToLetter, disputeReasons]
  );

  const updateDisputeReasons = React.useCallback((id: string, reasons: string[]) => {
    setDisputeReasons((prev) => ({ ...prev, [id]: reasons }));
  }, []);

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

    if (statusFilter === "positive") {
      filtered = filtered.filter((acc) => !isAccountNegative(acc));
    } else if (statusFilter === "negative") {
      filtered = filtered.filter((acc) => isAccountNegative(acc));
    }

    if (accountTypeFilter !== "all") {
      filtered = filtered.filter((acc) => acc.category === accountTypeFilter);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-amber-200/80 bg-amber-100/50 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-stone-800">Accounts</h2>
          <Badge variant="outline" className="text-xs">
            {filteredAccounts.length} of {allAccounts.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs text-stone-700"
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value as "all" | AccountCategory)}
          >
            <option value="all">All Types ({allAccounts.length})</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {ACCOUNT_TYPE_CATEGORIES[cat].label} ({accountsByCategory[cat].length})
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setAccountTypeFilter("all")}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Status Filter (Positive/Negative) */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-stone-600">Filter by:</span>
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded text-xs font-medium border transition-all",
            statusFilter === "all"
              ? "bg-stone-700 text-white border-stone-700"
              : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
          )}
        >
          All ({allAccounts.length})
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "positive" ? "all" : "positive")}
          className={cn(
            "px-3 py-1.5 rounded text-xs font-medium border transition-all",
            statusFilter === "positive"
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-green-700 border-green-300 hover:bg-green-50"
          )}
        >
          Positive ({positiveCount})
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "negative" ? "all" : "negative")}
          className={cn(
            "px-3 py-1.5 rounded text-xs font-medium border transition-all",
            statusFilter === "negative"
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-red-700 border-red-300 hover:bg-red-50"
          )}
        >
          Negative ({negativeCount})
        </button>
      </div>

      {/* Category Legend */}
      <div className="flex flex-wrap gap-2">
        {categoryOptions.map((cat) => (
          <button
            key={cat}
            onClick={() => setAccountTypeFilter(accountTypeFilter === cat ? "all" : cat)}
            className={cn(
              "px-2 py-1 rounded text-xs border transition-all",
              ACCOUNT_TYPE_CATEGORIES[cat].color,
              accountTypeFilter === cat && "ring-2 ring-offset-1 ring-stone-400"
            )}
            title={ACCOUNT_TYPE_CATEGORIES[cat].description}
          >
            {ACCOUNT_TYPE_CATEGORIES[cat].label} ({accountsByCategory[cat].length})
          </button>
        ))}
      </div>

      {/* Account Cards - Equifax style */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
        {groupedAccounts.map((group) => (
          <div key={group.key} className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
            {(() => {
              const tu = getAccountCompareSummary(group.accounts.transunion);
              const ex = getAccountCompareSummary(group.accounts.experian);
              const eq = getAccountCompareSummary(group.accounts.equifax);

              const present = [group.accounts.transunion, group.accounts.experian, group.accounts.equifax].filter(Boolean) as ExtractedAccount[];
              const worstCategory = present.reduce<AccountCategory | null>((acc, a) => {
                if (!acc) return a.category;
                return CATEGORY_SEVERITY[a.category] > CATEGORY_SEVERITY[acc] ? a.category : acc;
              }, null);
              const anyNegative = present.some((a) => isAccountNegative(a));

              const row = (label: string, a: string, b: string, c: string) => (
                <tr className="hover:bg-amber-50/40">
                  <td className="py-2 px-3 text-left text-xs font-medium text-stone-600 w-[200px] border-r border-amber-200/80">
                    {label}
                  </td>
                  <td className="py-2 px-3 text-center border-r border-amber-200/80 text-xs text-stone-700">{a}</td>
                  <td className="py-2 px-3 text-center border-r border-amber-200/80 text-xs text-stone-700">{b}</td>
                  <td className="py-2 px-3 text-center text-xs text-stone-700">{c}</td>
                </tr>
              );

              return (
                <>
                  <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-800 truncate">{group.creditorName}</div>
                      <div className="text-xs text-stone-500 truncate">
                        Account ID: <span className="font-medium text-stone-700">{group.accountIdentifier || "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {worstCategory ? (
                        <Badge variant="outline" className={cn("text-xs", ACCOUNT_TYPE_CATEGORIES[worstCategory].color)}>
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

                  <div className="p-4">
                    {(() => {
                      const available = (["transunion", "experian", "equifax"] as const)
                        .map((bureau) => ({ bureau, account: group.accounts[bureau] }))
                        .filter((x): x is { bureau: "transunion" | "experian" | "equifax"; account: ExtractedAccount } => Boolean(x.account));

                      const primaryAccount =
                        group.accounts.transunion ?? group.accounts.experian ?? group.accounts.equifax;

                      if (!primaryAccount) return null;

                      if (available.length === 1) {
                        const bureau = available[0].bureau;
                        return (
                          <div className="space-y-2">
                            <div className="flex justify-center">
                              {bureau === "transunion" ? <TransUnionLogo /> : bureau === "experian" ? <ExperianLogo /> : <EquifaxLogo />}
                            </div>
                            <AccountCard
                              account={primaryAccount}
                              showFullKeys={showFullKeys}
                              isNegative={isAccountNegative(primaryAccount)}
                              disputes={accountDisputes.get(primaryAccount.id) ?? []}
                              selectedDisputes={selectedDisputes}
                              disputeReasons={disputeReasons}
                              onToggleDisputeSelection={toggleDisputeSelection}
                              onUpdateDisputeReasons={updateDisputeReasons}
                              onSendToLetter={onSendToLetter}
                              onSendAccountSelectedToLetter={sendDisputesToLetter}
                            />
                          </div>
                        );
                      }

                      return (
                        <div
                          className={cn(
                            "grid gap-4",
                            available.length === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-3"
                          )}
                        >
                          {available.map(({ bureau, account }) => (
                            <div key={account.id} className="space-y-2">
                              <div className="flex justify-center">
                                {bureau === "transunion" ? <TransUnionLogo /> : bureau === "experian" ? <ExperianLogo /> : <EquifaxLogo />}
                              </div>
                              <AccountCard
                                account={account}
                                showFullKeys={showFullKeys}
                                isNegative={isAccountNegative(account)}
                                disputes={accountDisputes.get(account.id) ?? []}
                                selectedDisputes={selectedDisputes}
                                disputeReasons={disputeReasons}
                                onToggleDisputeSelection={toggleDisputeSelection}
                                onUpdateDisputeReasons={updateDisputeReasons}
                                onSendToLetter={onSendToLetter}
                                onSendAccountSelectedToLetter={sendDisputesToLetter}
                                showHeader={false}
                                inGrid={true}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {(() => {
                    const disputes = present
                      .flatMap((a) => accountDisputes.get(a.id) ?? [])
                      .sort((a, b) => {
                        const weight = (s: DisputeItem["severity"]) => {
                          if (s === "high") return 3;
                          if (s === "medium") return 2;
                          if (s === "low") return 1;
                          return 0;
                        };
                        return weight(b.severity) - weight(a.severity);
                      });

                    const paymentSource = present.find((a) => getPaymentHistoryTimeline(a.fields).length > 0);
                    const trendedSource = present.find((a) => {
                      const comments = getCreditComments(a.fields);
                      return Boolean(extractTrendedDataText(comments));
                    });

                    if (disputes.length === 0 && !paymentSource && !trendedSource) return null;

                    return (
                      <div className="px-4 pb-4">
                        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
                          <DisputeItemsPane
                            disputes={disputes}
                            selectedDisputes={selectedDisputes}
                            disputeReasons={disputeReasons}
                            onToggleDisputeSelection={toggleDisputeSelection}
                            onUpdateDisputeReasons={updateDisputeReasons}
                            onSendToLetter={onSendToLetter}
                            onSendAccountSelectedToLetter={sendDisputesToLetter}
                          />

                          <div className="px-4 pb-4">
                            {paymentSource ? <PaymentHistorySection fields={paymentSource.fields} /> : null}
                            {trendedSource ? <TrendedDataSection fields={trendedSource.fields} /> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}