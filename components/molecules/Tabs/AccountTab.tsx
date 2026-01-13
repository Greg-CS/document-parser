import { type ImportedFile } from "@/lib/interfaces/GlobalInterfaces"
import React from "react";
import { Badge } from "@/components/atoms/badge";
import { ACCOUNT_TYPE_CATEGORIES, AccountCategory } from "@/lib/types/Global";
import { cn, formatDisplayValue, normalizeTextDisplay } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import { AlertCircle, Eye, CreditCard } from "lucide-react";
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

// Helper to get field value with fallback keys
function getField(fields: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const normalizedSearch = normalizeKey(key);
    for (const [fieldKey, value] of Object.entries(fields)) {
      if (normalizeKey(fieldKey) === normalizedSearch && value !== undefined && value !== null) {
        return formatDisplayValue(value);
      }
    }
  }
  return "—";
}

// Key info fields to display in the grid
const KEY_INFO_FIELDS = [
  { label: "Date Opened", keys: ["dateopened", "date_opened", "opendate", "accountopeneddate"] },
  { label: "Date of 1st Delinquency", keys: ["firstdelinquencydate", "delinquencydate", "first_delinquency"] },
  { label: "Terms Frequency", keys: ["termsfrequency", "terms", "paymentfrequency"] },
  { label: "Date of Last Activity", keys: ["lastactivitydate", "dateofLastActivity", "last_activity"] },
  { label: "Date Major Delinquency", keys: ["majordelinquencydate", "major_delinquency"] },
  { label: "Months Reviewed", keys: ["monthsreviewed", "months_reviewed", "paymenthistorymonths"] },
  { label: "Scheduled Payment", keys: ["scheduledpayment", "monthlypayment", "monthly_payment"] },
  { label: "Amount Past Due", keys: ["amountpastdue", "pastdueamount", "past_due"] },
  { label: "Deferred Payment Start", keys: ["deferredpaymentstart", "deferred_start"] },
  { label: "Actual Payment", keys: ["actualpayment", "lastpaymentamount", "last_payment_amount"] },
  { label: "Charge Off Amount", keys: ["chargeoffamount", "charge_off_amount", "writeoff"] },
  { label: "Balloon Payment", keys: ["balloonpayment", "balloon_amount"] },
  { label: "Date of Last Payment", keys: ["lastpaymentdate", "date_last_payment", "dateoflastpayment"] },
  { label: "Date Closed", keys: ["dateclosed", "date_closed", "closedate"] },
  { label: "Balloon Payment Date", keys: ["balloonpaymentdate", "balloon_date"] },
  { label: "Term Duration", keys: ["termduration", "term_months", "loanterm"] },
  { label: "Activity Designator", keys: ["activitydesignator", "activity_code"] },
  { label: "Narrative Code", keys: ["narrativecode", "remark_code", "specialcomment"] },
];

// Account Card Component - Equifax style
function AccountCard({ 
  account,
  showFullKeys
}: { 
  account: ExtractedAccount;
  showFullKeys: boolean;
}) {
  const categoryConfig = ACCOUNT_TYPE_CATEGORIES[account.category];
  const isNegative = ["collection", "chargeoff", "derogatory"].includes(account.category);
  const fields = account.fields;
  
  // Extract key values
  const status = getField(fields, "accountstatus", "status", "paymentstatus");
  const balance = getField(fields, "currentbalance", "balance", "unpaidbalance");
  const creditLimit = getField(fields, "creditlimit", "highlimit", "high_credit");
  const highCredit = getField(fields, "highcredit", "highbalance", "highest_balance");
  const accountType = getField(fields, "accounttype", "type", "loantype");
  const owner = getField(fields, "owner", "accountowner", "ecoa");
  const dateReported = getField(fields, "datereported", "reportdate", "date_reported");
  
  // Get all fields for the details table
  const sortedFields = sortAccountFields(fields);
  
  return (
    <div className={cn(
      "rounded-lg border-2 overflow-hidden shadow-sm mb-4",
      isNegative ? "border-red-400" : "border-stone-300"
    )}>
      {/* Header Section */}
      <div className={cn(
        "px-4 py-3 border-b-2",
        isNegative ? "bg-red-50 border-red-300" : "bg-stone-50 border-stone-200"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isNegative ? "bg-red-100" : "bg-amber-100"
            )}>
              <CreditCard className={cn("w-5 h-5", isNegative ? "text-red-600" : "text-amber-600")} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900 text-lg">{account.creditorName}</h3>
                <span className="text-stone-500">-</span>
                <span className={cn(
                  "font-semibold",
                  status.toLowerCase().includes("closed") ? "text-stone-600" : 
                  isNegative ? "text-red-600" : "text-green-600"
                )}>
                  {status}
                </span>
              </div>
              <div className="text-sm text-stone-600 mt-0.5">
                Account Number: <span className="font-medium">{account.accountNumber || "—"}</span>
                {owner !== "—" && <> | Owner: <span className="font-medium">{owner}</span></>}
              </div>
              <div className="text-sm text-stone-600">
                Loan/Account Type: <span className="font-medium">{accountType}</span>
                {" | "}
                Status: <span className={cn(
                  "font-semibold",
                  isNegative ? "text-red-600" : "text-stone-700"
                )}>
                  {categoryConfig.label}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-stone-500">Date Reported: <span className="font-medium text-stone-700">{dateReported}</span></div>
            <div className="text-stone-500">Balance: <span className="font-bold text-stone-900">{balance}</span></div>
            <div className="text-stone-500">Credit Limit: <span className="font-medium text-stone-700">{creditLimit}</span></div>
            <div className="text-stone-500">High Credit: <span className="font-medium text-stone-700">{highCredit}</span></div>
          </div>
        </div>
        {isNegative && (
          <div className="mt-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-600">{categoryConfig.description}</span>
          </div>
        )}
      </div>
      
      {/* Key Info Grid */}
      <div className="px-4 py-3 bg-white border-b border-stone-200">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          {KEY_INFO_FIELDS.map(({ label, keys }) => {
            const value = getField(fields, ...keys);
            if (value === "—") return null;
            return (
              <div key={label} className="flex justify-between gap-2">
                <span className="text-stone-500 font-medium">{label}:</span>
                <span className="text-stone-800 font-semibold text-right">{value}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* All Fields Table */}
      <details className="group">
        <summary className="px-4 py-2 bg-stone-100 cursor-pointer hover:bg-stone-200 text-sm font-medium text-stone-700 flex items-center justify-between">
          <span>All Fields ({Object.keys(fields).length})</span>
          <Badge variant="outline" className="text-[10px]">
            Click to expand
          </Badge>
        </summary>
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-200">
              {sortedFields.map(([fieldKey, value]) => {
                const displayKey = showFullKeys ? fieldKey : normalizeTextDisplay(fieldKey);
                const isNestedObject = value !== null && typeof value === "object";
                const isPrimary = PRIMARY_FIELDS.some(p => normalizeKey(fieldKey).includes(normalizeKey(p)));
                
                return (
                  <tr key={fieldKey} className={cn(
                    "hover:bg-stone-50",
                    isPrimary && "bg-amber-50/50"
                  )}>
                    <td className="py-1.5 px-4 font-medium text-stone-600 w-1/3" title={fieldKey}>
                      {displayKey}
                    </td>
                    <td className="py-1.5 px-4 text-stone-800">
                      {isNestedObject ? (
                        <NestedObjectViewer fieldKey={fieldKey} value={value} />
                      ) : (
                        formatDisplayValue(value)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
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

      {/* Account Cards - Equifax style */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
        {filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            showFullKeys={showFullKeys}
          />
        ))}
      </div>
    </div>
  );
}