import { type ImportedFile } from "@/lib/interfaces/GlobalInterfaces"
import React from "react";
import { Badge } from "@/components/atoms/badge";
import { ACCOUNT_TYPE_CATEGORIES, AccountCategory } from "@/lib/types/Global";
import { cn, getValueAtPath, shortKey } from "@/lib/utils";
import { EquifaxLogo, ExperianLogo, TransUnionLogo } from "../icons/CreditBureauIcons";
import { Button } from "@/components/atoms/button";
import { ReportRow } from "../TableAssets/ReportRow";

interface AccountTabProp {
    tuFile?: ImportedFile;
    exFile?: ImportedFile;
    eqFile?: ImportedFile;
    showFullKeys: boolean;
}

// Account field patterns
const ACCOUNT_PATTERNS = [
  "account", "creditor", "balance", "limit", "payment", "status", "opened",
  "closed", "type", "tradeline", "credit"
];

function isAccountKey(key: string): boolean {
  const lower = key.toLowerCase();
  return ACCOUNT_PATTERNS.some(p => lower.includes(p));
}

function categorizeAccountKey(key: string): AccountCategory {
  const lower = key.toLowerCase().replace(/[^a-z0-9]/g, "_");
  for (const [category, config] of Object.entries(ACCOUNT_TYPE_CATEGORIES)) {
    if (config.patterns.some(p => lower.includes(p.replace(/[^a-z0-9]/g, "_")))) {
      return category as AccountCategory;
    }
  }
  return "revolving"; // Default to revolving for unmatched account fields
}

// Accounts Tab Component
export function AccountsTab({ tuFile, exFile, eqFile, showFullKeys }: AccountTabProp) {
  const [accountTypeFilter, setAccountTypeFilter] = React.useState<"all" | AccountCategory>("all");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

  const accountKeys = React.useMemo(() => {
    const keySet = new Set<string>();
    const addKeys = (file?: ImportedFile) => {
      if (file) file.keys.filter(isAccountKey).forEach(k => keySet.add(k));
    };
    addKeys(tuFile);
    addKeys(exFile);
    addKeys(eqFile);
    return Array.from(keySet).sort();
  }, [tuFile, exFile, eqFile]);

  // Group accounts by type using proper credit report categories
  const accountsByType = React.useMemo(() => {
    const groups: Record<AccountCategory, string[]> = {
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
    for (const key of accountKeys) {
      const category = categorizeAccountKey(key);
      groups[category].push(key);
    }
    return groups;
  }, [accountKeys]);

  const accountTypeOptions = (Object.keys(accountsByType) as AccountCategory[]).filter(t => accountsByType[t].length > 0);

  const filteredKeys = React.useMemo(() => {
    let keys = accountTypeFilter === "all" 
      ? accountKeys 
      : accountsByType[accountTypeFilter] || [];
    
    if (sortOrder === "desc") {
      keys = [...keys].reverse();
    }
    return keys;
  }, [accountKeys, accountsByType, accountTypeFilter, sortOrder]);

  if (accountKeys.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200/80 bg-amber-50 p-6 text-center">
        <p className="text-stone-600 text-sm">No account fields found in the report</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-stone-800">Account Details</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{filteredKeys.length} of {accountKeys.length}</Badge>
          <select
            className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs text-stone-700"
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value as "all" | AccountCategory)}
          >
            <option value="all">All Types</option>
            {accountTypeOptions.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_CATEGORIES[t].label} ({accountsByType[t].length})
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs text-stone-700"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          >
            <option value="asc">Sort: A-Z</option>
            <option value="desc">Sort: Z-A</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setAccountTypeFilter("all");
              setSortOrder("asc");
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Account Type Legend */}
      <div className="px-4 py-2 border-b border-amber-200/80 bg-amber-50 flex flex-wrap gap-2">
        {accountTypeOptions.map((t) => (
          <button
            key={t}
            onClick={() => setAccountTypeFilter(accountTypeFilter === t ? "all" : t)}
            className={cn(
              "px-2 py-1 rounded text-xs border transition-all",
              ACCOUNT_TYPE_CATEGORIES[t].color,
              accountTypeFilter === t && "ring-2 ring-offset-1 ring-stone-400"
            )}
            title={ACCOUNT_TYPE_CATEGORIES[t].description}
          >
            {ACCOUNT_TYPE_CATEGORIES[t].label} ({accountsByType[t].length})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
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
            {filteredKeys.map((key) => {
              const category = categorizeAccountKey(key);
              const categoryConfig = ACCOUNT_TYPE_CATEGORIES[category];
              return (
                <ReportRow
                  key={key}
                  label={key}
                  shortLabel={shortKey(key)}
                  showFullKey={showFullKeys}
                  categoryConfig={categoryConfig}
                  values={[
                    tuFile ? getValueAtPath(tuFile.data, key) : undefined,
                    exFile ? getValueAtPath(exFile.data, key) : undefined,
                    eqFile ? getValueAtPath(eqFile.data, key) : undefined,
                  ]}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}