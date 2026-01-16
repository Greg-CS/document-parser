import { type ImportedFile } from "@/lib/interfaces/GlobalInterfaces"
import React from "react";
import { Badge } from "@/components/atoms/badge";
import { ACCOUNT_TYPE_CATEGORIES, AccountCategory } from "@/lib/types/Global";
import { cn, formatDisplayValue, normalizeTextDisplay, shortKey } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import { Checkbox } from "@/components/atoms/checkbox";
import { AlertCircle, Eye, CreditCard, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/atoms/dialog";
import {
  DisputeItem,
  generateDisputeReason,
  getDisputeSeverity,
  getFieldCategory,
  isNegativeValue,
  shouldSurfaceDisputeItem,
} from "@/lib/dispute-fields";

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
  bureau: "transunion" | "experian" | "equifax";
  liabilityIndex?: number;
}

function getNestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const part of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[@_\-\s]/g, "");
}

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

// Helper to get field value with fallback keys
function getRawField(fields: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const keyParts = key.split(".").filter(Boolean);
    if (keyParts.length > 1) {
      const nestedValue = getNestedValue(fields, keyParts);
      if (nestedValue !== undefined && nestedValue !== null) return nestedValue;
      continue;
    }

    const normalizedSearch = normalizeKey(key);
    for (const [fieldKey, value] of Object.entries(fields)) {
      if (normalizeKey(fieldKey) === normalizedSearch && value !== undefined && value !== null) {
        return value;
      }
    }
  }
  return undefined;
}

function getField(fields: Record<string, unknown>, ...keys: string[]): string {
  const raw = getRawField(fields, ...keys);
  if (raw === undefined || raw === null) return "—";
  return formatDisplayValue(raw);
}

function formatDateValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoDateMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoDateMatch) return isoDateMatch[0];
    return trimmed;
  }
  return formatDisplayValue(value);
}

function formatMoneyValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return formatDisplayValue(value);
  if (num >= 999_999_000) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
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
  showFullKeys,
  isNegative,
  disputes,
  selectedDisputes,
  onToggleDisputeSelection,
  onSendToLetter,
  onSendAccountSelectedToLetter
}: { 
  account: ExtractedAccount;
  showFullKeys: boolean;
  isNegative: boolean;
  disputes: DisputeItem[];
  selectedDisputes: Set<string>;
  onToggleDisputeSelection: (id: string) => void;
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void;
  onSendAccountSelectedToLetter: (items: DisputeItem[]) => void;
}) {
  const categoryConfig = ACCOUNT_TYPE_CATEGORIES[account.category];
  const fields = account.fields;

  const accountSelectedDisputes = React.useMemo(() => {
    return disputes.filter((d) => selectedDisputes.has(d.id));
  }, [disputes, selectedDisputes]);
  
  // Extract key values
  const status = getField(fields, "accountstatus", "status", "paymentstatus");
  const balance = formatMoneyValue(getRawField(
    fields,
    "@_UnpaidBalanceAmount",
    "unpaidbalanceamount",
    "currentbalance",
    "balance",
    "balanceamount",
    "@_OriginalBalanceAmount",
    "originalbalanceamount"
  ));
  const creditLimit = formatMoneyValue(getRawField(
    fields,
    "@_CreditLimitAmount",
    "creditlimitamount",
    "creditlimit",
    "highlimit",
    "high_credit"
  ));
  const highCredit = formatMoneyValue(getRawField(
    fields,
    "@_HighCreditAmount",
    "highcreditamount",
    "highcredit",
    "@_HighBalanceAmount",
    "highbalanceamount",
    "highbalance",
    "highest_balance"
  ));
  const accountType = getField(fields, "accounttype", "type", "loantype");
  const owner = getField(fields, "owner", "accountowner", "ecoa");
  const dateReported = formatDateValue(getRawField(
    fields,
    "@_AccountReportedDate",
    "accountreporteddate",
    "datereported",
    "reportdate",
    "date_reported"
  ));
  
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
            {disputes.length > 0 && (
              <div className="mt-1">
                <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0">
                  {disputes.length} dispute item{disputes.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            )}
          </div>
        </div>
        {isNegative && (
          <div className="mt-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-600">{categoryConfig.description}</span>
          </div>
        )}
      </div>

      {disputes.length > 0 && (
        <details className="group border-b border-stone-200">
          <summary className="px-4 py-2 bg-red-50 cursor-pointer hover:bg-red-100 text-sm font-medium text-red-700 flex items-center justify-between">
            <span>Dispute Items ({disputes.length})</span>
            {onSendToLetter && accountSelectedDisputes.length > 0 && (
              <Button
                size="sm"
                className="h-7 px-2 bg-purple-600 hover:bg-purple-700"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSendAccountSelectedToLetter(accountSelectedDisputes);
                }}
              >
                <Send className="w-3 h-3 mr-1" />
                Send ({accountSelectedDisputes.length})
              </Button>
            )}
          </summary>
          <div className="divide-y divide-stone-200 bg-white">
            {disputes.map((item) => (
              <div key={item.id} className="px-4 py-2 flex items-start gap-3">
                {onSendToLetter && (
                  <Checkbox
                    checked={selectedDisputes.has(item.id)}
                    onCheckedChange={() => onToggleDisputeSelection(item.id)}
                    className="mt-1"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-800">{item.reason}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {item.bureau.charAt(0).toUpperCase() + item.bureau.slice(1)}
                    </Badge>
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5 truncate">
                    {shortKey(item.fieldPath)}: {formatDisplayValue(item.value)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      
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

  // Extract accounts from all bureau files
  const allAccounts = React.useMemo(() => {
    const accounts: ExtractedAccount[] = [];
    
    if (tuFile?.data) {
      accounts.push(...extractAccountsFromData(tuFile.data, "transunion"));
    }
    if (exFile?.data) {
      accounts.push(...extractAccountsFromData(exFile.data, "experian"));
    }
    if (eqFile?.data) {
      accounts.push(...extractAccountsFromData(eqFile.data, "equifax"));
    }
    
    return accounts;
  }, [tuFile, exFile, eqFile]);

  const accountDisputes = React.useMemo(() => {
    const map = new Map<string, DisputeItem[]>();

    for (const acc of allAccounts) {
      const creditorName = acc.creditorName || "Unknown";
      const accountIdentifier = String(
        getRawField(acc.fields, "@_AccountIdentifier", "accountidentifier", "accountNumber", "account_number") ?? ""
      );

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
        label: `${item.creditorName || "Unknown"} - ${item.reason}`,
        value: `${shortKey(item.fieldPath)}: ${formatDisplayValue(item.value)}`,
      }));
      onSendToLetter(items);
      setSelectedDisputes(new Set());
    },
    [onSendToLetter]
  );

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

  // Count positive and negative accounts
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
    
    // Apply status filter (positive/negative)
    if (statusFilter === "positive") {
      filtered = filtered.filter(acc => !isAccountNegative(acc));
    } else if (statusFilter === "negative") {
      filtered = filtered.filter(acc => isAccountNegative(acc));
    }
    
    // Apply category filter
    if (accountTypeFilter !== "all") {
      filtered = filtered.filter(acc => acc.category === accountTypeFilter);
    }
    
    return filtered;
  }, [sortedAccounts, accountTypeFilter, statusFilter, isAccountNegative]);

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
        {filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            showFullKeys={showFullKeys}
            isNegative={isAccountNegative(account)}
            disputes={accountDisputes.get(account.id) ?? []}
            selectedDisputes={selectedDisputes}
            onToggleDisputeSelection={toggleDisputeSelection}
            onSendToLetter={onSendToLetter}
            onSendAccountSelectedToLetter={sendDisputesToLetter}
          />
        ))}
      </div>
    </div>
  );
}