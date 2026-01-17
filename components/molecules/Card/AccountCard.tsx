import { Badge } from "@/components/atoms/badge";
import { DisputeItem } from "@/lib/dispute-fields";
import { ExtractedAccount } from "@/lib/interfaces/GlobalInterfaces";
import { ACCOUNT_TYPE_CATEGORIES } from "@/lib/types/Global";
import { cn, formatDateValue, formatDisplayValue, formatMoneyValue, getField, getRawField, normalizeKey, normalizeTextDisplay } from "@/lib/utils";
import { AlertCircle, CreditCard, Eye } from "lucide-react";
import React from "react";
import { DisputeItemsPane } from "../TableAssets/DisputeItemsPane";
import { TrendedDataSection } from "@/components/organisms/sections/TrendedDataSection";
import { PaymentHistorySection } from "@/components/organisms/sections/PaymentHistorySection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/atoms/dialog";

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

// Key info fields to display in the grid
const KEY_INFO_FIELDS = [
  { label: "Account Identifier", keys: ["@_AccountIdentifier", "accountidentifier", "accountNumber", "account_number"] },
  { label: "Owner", keys: ["@_AccountOwnershipType", "accountownershiptype", "owner", "accountowner", "ecoa"] },
  { label: "Account Type", keys: ["@_AccountType", "accounttype", "type", "loantype"] },
  { label: "Account Status", keys: ["@_AccountStatusType", "accountstatus", "status", "paymentstatus"] },
  { label: "Date Reported", keys: ["@_AccountReportedDate", "accountreporteddate", "datereported", "reportdate", "date_reported"] },
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
  { label: "Late 30 Days", keys: ["_LATE_COUNT.@_30Days", "latecount30days"] },
  { label: "Late 60 Days", keys: ["_LATE_COUNT.@_60Days", "latecount60days"] },
  { label: "Late 90 Days", keys: ["_LATE_COUNT.@_90Days", "latecount90days"] },
  { label: "Payment Pattern Start", keys: ["_PAYMENT_PATTERN.@_StartDate", "paymentpatternstartdate"] },
];

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

// Account Card Component - Equifax style
export function AccountCard({
  account,
  showFullKeys,
  isNegative,
  disputes,
  selectedDisputes,
  disputeReasons,
  onToggleDisputeSelection,
  onUpdateDisputeReasons,
  onSendToLetter,
  onSendAccountSelectedToLetter,
  showHeader = true,
  inGrid = false,
}: {
  account: ExtractedAccount;
  showFullKeys: boolean;
  isNegative: boolean;
  disputes: DisputeItem[];
  selectedDisputes: Set<string>;
  disputeReasons: Record<string, string[]>;
  onToggleDisputeSelection: (id: string) => void;
  onUpdateDisputeReasons: (id: string, reasons: string[]) => void;
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void;
  onSendAccountSelectedToLetter: (items: DisputeItem[]) => void;
  showHeader?: boolean;
  inGrid?: boolean;
}) {
  const categoryConfig = ACCOUNT_TYPE_CATEGORIES[account.category];
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
    getRawField(
      fields,
      "@_CreditLimitAmount",
      "creditlimitamount",
      "creditlimit",
      "highlimit",
      "high_credit"
    )
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

  const sortedFields = sortAccountFields(fields);

  return (
    <div className={cn(
      "rounded-lg border-2 overflow-hidden shadow-sm",
      !inGrid && "mb-4",
      isNegative ? "border-red-400" : "border-stone-300"
    )}>
      {showHeader ? (
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
      ) : null}

      {!inGrid ? (
        <DisputeItemsPane
          disputes={disputes}
          selectedDisputes={selectedDisputes}
          disputeReasons={disputeReasons}
          onToggleDisputeSelection={onToggleDisputeSelection}
          onUpdateDisputeReasons={onUpdateDisputeReasons}
          onSendToLetter={onSendToLetter}
          onSendAccountSelectedToLetter={onSendAccountSelectedToLetter}
        />
      ) : null}

      {/* Key Info Grid */}
      <div className="px-4 py-3 bg-white border-b border-stone-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          {KEY_INFO_FIELDS.map(({ label, keys }) => {
            const value = getField(fields, ...keys);
            const isMissing = value === "—";
            return (
              <div key={label} className="flex justify-between gap-2">
                <span className={cn("font-medium", isMissing ? "text-stone-400" : "text-stone-500")}>{label}:</span>
                <span className={cn("font-semibold text-right", isMissing ? "text-stone-400" : "text-stone-800")}>{value}</span>
              </div>
            );
          })}
        </div>

        {!inGrid ? (
          <>
            <PaymentHistorySection fields={fields} />
            <TrendedDataSection fields={fields} />
          </>
        ) : null}
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