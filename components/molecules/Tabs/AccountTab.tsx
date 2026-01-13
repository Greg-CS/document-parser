import { type ImportedFile } from "@/lib/interfaces/GlobalInterfaces"
import React from "react";
import { Badge } from "@/components/atoms/badge";
import { ACCOUNT_TYPE_CATEGORIES, AccountCategory } from "@/lib/types/Global";
import { cn, formatDisplayValue, normalizeTextDisplay } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import { AlertCircle, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/atoms/dialog";

interface AccountTabProp {
    tuFile?: ImportedFile;
    exFile?: ImportedFile;
    eqFile?: ImportedFile;
    showFullKeys: boolean;
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

// Fields to display as primary info for each account
const PRIMARY_FIELDS = [
  "creditorname", "creditor_name", "subscribername", "subscriber_name", "name",
  "accountnumber", "account_number", "accountidentifier",
  "accounttype", "account_type", "type",
  "currentbalance", "current_balance", "balance", "balanceamount",
  "creditlimit", "credit_limit", "highlimit", "high_limit",
  "paymentstatus", "payment_status", "accountstatus", "account_status", "status",
  "dateopened", "date_opened", "opendate", "open_date", "opened",
  "dateclosed", "date_closed", "closedate", "close_date", "closed",
  "monthlypayment", "monthly_payment", "scheduledpayment",
];

interface ExtractedAccount {
  id: string;
  category: AccountCategory;
  creditorName: string;
  accountNumber: string;
  fields: Record<string, unknown>;
  sourceKey: string;
  index: number;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[@_\-\s]/g, "");
}

function categorizeAccount(fields: Record<string, unknown>): AccountCategory {
  const fieldStr = JSON.stringify(fields).toLowerCase();
  
  // Check for collection indicators
  if (fieldStr.includes("collection") || 
      fields["isCollectionIndicator"] === "Y" || 
      fields["isCollectionIndicator"] === true ||
      fields["collectionIndicator"] === "Y") {
    return "collection";
  }
  
  // Check for charge-off
  if (fieldStr.includes("chargeoff") || fieldStr.includes("charge_off") ||
      fieldStr.includes("charged off")) {
    return "chargeoff";
  }
  
  // Check for derogatory
  if (fields["derogatoryDataIndicator"] === "Y" || 
      fields["derogatory"] === true ||
      fieldStr.includes("derogatory")) {
    return "derogatory";
  }
  
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

function extractAccountsFromData(data: unknown, sourceKey: string): ExtractedAccount[] {
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
            const creditorName = String(
              fields["creditorName"] || fields["creditor_name"] || 
              fields["subscriberName"] || fields["subscriber_name"] ||
              fields["name"] || fields["@_Name"] || "Unknown"
            );
            const accountNumber = String(
              fields["accountNumber"] || fields["account_number"] ||
              fields["accountIdentifier"] || fields["@_AccountIdentifier"] || ""
            );
            
            accounts.push({
              id: `${sourceKey}-${path}-${idx}`,
              category: categorizeAccount(fields),
              creditorName,
              accountNumber: accountNumber.slice(-4) ? `****${accountNumber.slice(-4)}` : "",
              fields,
              sourceKey: `${path}[${idx}]`,
              index: idx,
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

// Account Header Row - displays as a separator between accounts
function AccountHeaderRow({ 
  account,
  isFirst
}: { 
  account: ExtractedAccount;
  isFirst: boolean;
}) {
  const categoryConfig = ACCOUNT_TYPE_CATEGORIES[account.category];
  const isNegative = ["collection", "chargeoff", "derogatory"].includes(account.category);
  
  return (
    <tr className={cn(
      isNegative ? "bg-red-100/70" : "bg-amber-200/50",
      !isFirst && "border-t-4 border-stone-300"
    )}>
      <td colSpan={4} className="py-2 px-3">
        <div className="flex items-center gap-3">
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border",
            categoryConfig.color
          )}>
            {isNegative && <AlertCircle className="w-3 h-3" />}
            {categoryConfig.label}
          </span>
          <span className="font-semibold text-stone-800">{account.creditorName}</span>
          {account.accountNumber && (
            <span className="text-xs text-stone-500">{account.accountNumber}</span>
          )}
          <Badge variant="outline" className="text-[10px] ml-auto">
            {Object.keys(account.fields).length} fields
          </Badge>
        </div>
      </td>
    </tr>
  );
}

// Nested Object Viewer Modal
function NestedObjectViewer({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const jsonString = React.useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "[Unable to serialize]";
    }
  }, [value]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded transition-colors">
          <Eye className="w-3 h-3" />
          <span>{Array.isArray(value) ? `[${(value as unknown[]).length} items]` : "{...}"}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-stone-700">
            {normalizeTextDisplay(fieldKey)}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-stone-50 rounded border border-stone-200 p-3">
          <pre className="text-xs text-stone-700 whitespace-pre-wrap font-mono">
            {jsonString}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Account Field Row - displays a single field within an account
function AccountFieldRow({
  fieldKey,
  value,
  showFullKeys,
  isNegative
}: {
  fieldKey: string;
  value: unknown;
  showFullKeys: boolean;
  isNegative: boolean;
}) {
  const displayKey = showFullKeys ? fieldKey : normalizeTextDisplay(fieldKey);
  const isPrimary = PRIMARY_FIELDS.some(p => normalizeKey(fieldKey).includes(normalizeKey(p)));
  const isNestedObject = value !== null && typeof value === "object";
  
  return (
    <tr className={cn(
      "hover:bg-amber-100/40",
      isNegative ? "bg-red-50/30" : "",
      isPrimary && (isNegative ? "bg-red-50/60" : "bg-amber-50/60")
    )}>
      <td className="py-1.5 px-3 font-medium text-stone-600 text-sm border-r border-amber-200/60" title={fieldKey}>
        {displayKey}
      </td>
      <td colSpan={3} className="py-1.5 px-3 text-stone-800 text-sm">
        {isNestedObject ? (
          <NestedObjectViewer fieldKey={fieldKey} value={value} />
        ) : (
          formatDisplayValue(value)
        )}
      </td>
    </tr>
  );
}

// Sort fields helper
function sortAccountFields(fields: Record<string, unknown>): [string, unknown][] {
  const entries = Object.entries(fields);
  return entries.sort(([a], [b]) => {
    const aNorm = normalizeKey(a);
    const bNorm = normalizeKey(b);
    const aIsPrimary = PRIMARY_FIELDS.some(p => aNorm.includes(normalizeKey(p)));
    const bIsPrimary = PRIMARY_FIELDS.some(p => bNorm.includes(normalizeKey(p)));
    if (aIsPrimary && !bIsPrimary) return -1;
    if (!aIsPrimary && bIsPrimary) return 1;
    return a.localeCompare(b);
  });
}

// Accounts Tab Component
export function AccountsTab({ tuFile, exFile, eqFile, showFullKeys }: AccountTabProp) {
  const [accountTypeFilter, setAccountTypeFilter] = React.useState<"all" | AccountCategory>("all");

  // Extract accounts from all bureau files
  const allAccounts = React.useMemo(() => {
    const accounts: ExtractedAccount[] = [];
    
    if (tuFile?.data) {
      accounts.push(...extractAccountsFromData(tuFile.data, "tu"));
    }
    if (exFile?.data) {
      accounts.push(...extractAccountsFromData(exFile.data, "ex"));
    }
    if (eqFile?.data) {
      accounts.push(...extractAccountsFromData(eqFile.data, "eq"));
    }
    
    return accounts;
  }, [tuFile, exFile, eqFile]);

  // Group accounts by category
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
    
    for (const account of allAccounts) {
      groups[account.category].push(account);
    }
    
    return groups;
  }, [allAccounts]);

  const categoryOptions = (Object.keys(accountsByCategory) as AccountCategory[])
    .filter(cat => accountsByCategory[cat].length > 0);

  // Sort accounts by severity (least important first, most important last)
  const sortedAccounts = React.useMemo(() => {
    return [...allAccounts].sort((a, b) => 
      CATEGORY_SEVERITY[a.category] - CATEGORY_SEVERITY[b.category]
    );
  }, [allAccounts]);

  const filteredAccounts = React.useMemo(() => {
    if (accountTypeFilter === "all") return sortedAccounts;
    return sortedAccounts.filter(acc => acc.category === accountTypeFilter);
  }, [sortedAccounts, accountTypeFilter]);

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

      {/* Accounts Table - continuous view with separators */}
      <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full min-w-[600px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-amber-200/80 bg-amber-100/80">
                <th className="py-2 px-3 text-left text-sm font-medium text-stone-600 w-1/3">
                  Field
                </th>
                <th className="py-2 px-3 text-left text-sm font-medium text-stone-600">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account, accountIdx) => {
                const isNegative = ["collection", "chargeoff", "derogatory"].includes(account.category);
                const sortedFields = sortAccountFields(account.fields);
                
                return (
                  <React.Fragment key={account.id}>
                    {/* Account Header Row */}
                    <AccountHeaderRow account={account} isFirst={accountIdx === 0} />
                    
                    {/* Account Field Rows */}
                    {sortedFields.map(([fieldKey, value]) => (
                      <AccountFieldRow
                        key={`${account.id}-${fieldKey}`}
                        fieldKey={fieldKey}
                        value={value}
                        showFullKeys={showFullKeys}
                        isNegative={isNegative}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}