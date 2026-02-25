"use client"

import * as React from "react"
import { cn, normalizeFieldName, formatDisplayValue, getRawField } from "@/lib/utils"
import { type DisputeItem, SEVERITY_COLORS, CATEGORY_LABELS } from "@/lib/dispute-fields"
import { TransUnionLogo, EquifaxLogo, ExperianLogo } from "../icons/CreditBureauIcons"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from "@/components/atoms/responsiveModal"
import { ScrollArea } from "@/components/atoms/scroll-area"
import { Badge } from "@/components/atoms/badge"
import { Button } from "@/components/atoms/button"
import { AlertTriangle, Send, Sparkles, ExternalLink, Info, Shield, Loader2, Zap, CheckCircle2, HelpCircle, FileText, Scale } from "lucide-react"

interface AIDisputeAnalysis {
  reasons: Array<{ id: string; label: string; confidence: number }>
  summary: string
  laymanExplanation: string
  severity: "high" | "medium" | "low"
  impactDescription: string
  loading: boolean
  error?: string
}

interface AccountContext {
  creditorName: string
  accountIdentifier: string
  accountType?: string
  balance?: string
  status?: string
  openDate?: string
  bureau: "transunion" | "experian" | "equifax"
  allFields?: Record<string, unknown>
}

// Grouped account data for bureau comparison
export interface GroupedAccountData {
  creditorName: string
  accountIdentifier: string
  transunion?: Record<string, unknown>
  experian?: Record<string, unknown>
  equifax?: Record<string, unknown>
}

interface DisputeAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  disputeItem: DisputeItem | null
  accountContext?: AccountContext
  groupedAccount?: GroupedAccountData
  aiAnalysis?: AIDisputeAnalysis
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void
  onAnalyze?: (item: DisputeItem) => void
  existingReasons?: string[]
}

// Helper to get field value from account fields
function getField(fields: Record<string, unknown> | undefined, ...keys: string[]): string {
  if (!fields) return "—"
  const raw = getRawField(fields, ...keys)
  if (raw === undefined || raw === null) return "—"
  return formatDisplayValue(raw)
}

// Helper to format money values
function formatMoneyValue(value: unknown): string {
  if (value === undefined || value === null) return "—"
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(num)) return formatDisplayValue(value)
  if (num >= 999_999_000) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num)
}

// Helper to format date values
function formatDateValue(value: unknown): string {
  if (value === undefined || value === null) return "—"
  const str = String(value)
  if (!str || str === "—") return "—"
  const date = new Date(str)
  if (isNaN(date.getTime())) return str
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

// Get account summary for comparison
function getAccountCompareSummary(fields?: Record<string, unknown>) {
  if (!fields) {
    return {
      status: "—",
      dateReported: "—",
      balance: "—",
      creditLimit: "—",
      highCredit: "—",
      accountType: "—",
      owner: "—",
    }
  }

  const status = getField(fields, "accountstatus", "status", "paymentstatus", "@_AccountStatusType")
  const balance = formatMoneyValue(
    getRawField(fields, "@_UnpaidBalanceAmount", "unpaidbalanceamount", "currentbalance", "balance", "@_OriginalBalanceAmount")
  )
  const creditLimit = formatMoneyValue(
    getRawField(fields, "@_CreditLimitAmount", "creditlimitamount", "creditlimit", "highlimit")
  )
  const highCredit = formatMoneyValue(
    getRawField(fields, "@_HighCreditAmount", "highcreditamount", "highcredit", "@_HighBalanceAmount")
  )
  const accountType = getField(fields, "accounttype", "type", "loantype", "@_AccountType")
  const owner = getField(fields, "owner", "accountowner", "ecoa", "@_AccountOwnershipType")
  const dateReported = formatDateValue(
    getRawField(fields, "@_AccountReportedDate", "accountreporteddate", "datereported", "reportdate")
  )

  return { status, dateReported, balance, creditLimit, highCredit, accountType, owner }
}

const SEVERITY_LABELS: Record<string, { label: string; description: string; action: string }> = {
  high: { 
    label: "High Impact", 
    description: "This issue significantly affects your credit score.",
    action: "We recommend disputing this item as a priority."
  },
  medium: { 
    label: "Medium Impact", 
    description: "This issue moderately affects your credit score.",
    action: "Consider disputing this after addressing high-priority items."
  },
  low: { 
    label: "Low Impact", 
    description: "This is a minor issue with limited score impact.",
    action: "Worth correcting for accuracy, but not urgent."
  },
}

// Metro 2 Rating Code explanations
const RATING_CODE_EXPLANATIONS: Record<string, string> = {
  "1": "30 days late payment",
  "2": "60 days late payment",
  "3": "90 days late payment",
  "4": "120 days late payment",
  "5": "150 days late payment",
  "6": "180+ days late payment",
  "7": "Wage earner plan (Chapter 13 bankruptcy)",
  "8": "Repossession",
  "9": "Charged off to bad debt / Collection account",
  "CO": "Charge-off",
  "FC": "Foreclosure",
  "BK": "Bankruptcy",
  "RP": "Repossession",
  "LS": "Lease deficiency",
  "DA": "Delete entire account",
  "PN": "Paid never late",
  "RF": "Refinanced",
  "VS": "Voluntary surrender",
  "WO": "Charged off to bad debt",
}

function getFieldExplanation(fieldPath: string, value: unknown, reason: string): { title: string; description: string; impact: string } {
  const fieldLower = fieldPath.toLowerCase();
  const valueStr = String(value);
  
  // Rating Code explanations
  if (fieldLower.includes("code") || fieldLower.includes("rating")) {
    const explanation = RATING_CODE_EXPLANATIONS[valueStr.toUpperCase()];
    if (explanation) {
      return {
        title: "Payment Status Code",
        description: `This account is reporting a "${valueStr}" code, which means: ${explanation}.`,
        impact: "Negative payment codes like this can significantly lower your credit score and remain on your report for up to 7 years."
      };
    }
  }
  
  // Collection indicators
  if (fieldLower.includes("collection")) {
    return {
      title: "Collection Account",
      description: "This account has been sent to collections, meaning the original creditor has given up on collecting the debt and sold or transferred it to a collection agency.",
      impact: "Collection accounts are one of the most damaging items on a credit report and can drop your score by 100+ points."
    };
  }
  
  // Charge-off indicators
  if (fieldLower.includes("chargeoff") || fieldLower.includes("charge-off")) {
    return {
      title: "Charged-Off Account",
      description: "The creditor has written off this debt as a loss, meaning they don't expect to collect it. This doesn't mean you don't owe the money—it means the creditor has given up trying to collect.",
      impact: "Charge-offs severely damage your credit score and can remain on your report for 7 years from the date of first delinquency."
    };
  }
  
  // Late payment counts
  if (fieldLower.includes("late") && fieldLower.includes("days")) {
    const count = parseInt(valueStr, 10);
    const daysLate = fieldLower.includes("30") ? "30" : fieldLower.includes("60") ? "60" : "90+";
    return {
      title: `${daysLate}-Day Late Payments`,
      description: `This account shows ${count} payment${count !== 1 ? 's' : ''} that ${count !== 1 ? 'were' : 'was'} ${daysLate} days late.`,
      impact: `Late payments hurt your credit score, with ${daysLate === "90+" ? "90+ day lates being the most severe" : daysLate === "60" ? "60-day lates causing significant damage" : "30-day lates having moderate impact"}. They remain on your report for 7 years.`
    };
  }
  
  // Payment pattern
  if (fieldLower.includes("payment") && fieldLower.includes("pattern")) {
    return {
      title: "Payment History Pattern",
      description: "This shows your month-by-month payment history. The pattern contains codes indicating late payments or other negative statuses.",
      impact: "Payment history is the most important factor in your credit score (35%). Any late payments shown here directly impact your score."
    };
  }
  
  // Derogatory indicator
  if (fieldLower.includes("derogatory")) {
    return {
      title: "Derogatory Mark",
      description: "This account is flagged as derogatory, meaning it contains negative information that creditors view as a serious risk.",
      impact: "Derogatory marks are red flags to lenders and can prevent you from getting approved for new credit or result in higher interest rates."
    };
  }
  
  // Account status
  if (fieldLower.includes("status") && (valueStr.toLowerCase().includes("collection") || valueStr.toLowerCase().includes("chargeoff") || valueStr.toLowerCase().includes("delinquent"))) {
    return {
      title: "Negative Account Status",
      description: `This account's status is reported as "${valueStr}", which is a negative status that indicates serious payment problems.`,
      impact: "Accounts with negative statuses severely damage your creditworthiness and can remain on your report for up to 7 years."
    };
  }
  
  // Bankruptcy
  if (fieldLower.includes("bankruptcy")) {
    return {
      title: "Bankruptcy Filing",
      description: "This is a bankruptcy record, which is a legal proceeding where you declared inability to repay debts.",
      impact: "Bankruptcies are the most damaging items on a credit report, remaining for 7-10 years and making it very difficult to obtain new credit."
    };
  }
  
  // Foreclosure
  if (fieldLower.includes("foreclosure")) {
    return {
      title: "Foreclosure",
      description: "This indicates a foreclosure, where the lender repossessed your property due to non-payment of the mortgage.",
      impact: "Foreclosures severely damage credit scores and remain on your report for 7 years, making it difficult to obtain future mortgages."
    };
  }
  
  // Repossession
  if (fieldLower.includes("repossession")) {
    return {
      title: "Repossession",
      description: "This shows a repossession, where the lender took back the property (usually a vehicle) due to non-payment.",
      impact: "Repossessions are serious negative marks that can drop your score by 100+ points and remain on your report for 7 years."
    };
  }
  
  // Default explanation
  return {
    title: normalizeFieldName(fieldPath),
    description: `This field is showing: ${valueStr}`,
    impact: reason || "This may negatively impact your credit score and should be verified for accuracy."
  };
}

export function DisputeAccountModal({
  open,
  onOpenChange,
  disputeItem,
  accountContext,
  groupedAccount,
  aiAnalysis,
  onSendToLetter,
  onAnalyze,
  existingReasons = [],
}: DisputeAccountModalProps) {
  const [selectedReasons, setSelectedReasons] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (disputeItem && aiAnalysis?.reasons?.length) {
      const newReasons = aiAnalysis.reasons
        .map(r => r.label)
        .filter(label => !existingReasons.includes(label))
      setSelectedReasons(new Set(newReasons))
    }
  }, [disputeItem, aiAnalysis, existingReasons])

  // REMOVED: Auto-trigger AI analysis - now user must click button to save API tokens

  const handleSendToLetter = () => {
    if (!onSendToLetter || !disputeItem || selectedReasons.size === 0) return

    const reasonsList = Array.from(selectedReasons)
    const items = reasonsList.map(reason => ({
      label: `${disputeItem.creditorName || "Unknown"} - ${reason}`,
      value: aiAnalysis?.laymanExplanation || `${normalizeFieldName(disputeItem.fieldPath)}: ${formatDisplayValue(disputeItem.value)}`,
    }))

    onSendToLetter(items)
    onOpenChange(false)
  }

  const toggleReason = (label: string) => {
    if (existingReasons.includes(label)) return
    setSelectedReasons(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  if (!disputeItem) return null

  const bureauIcon = disputeItem.bureau === "transunion" 
    ? <TransUnionLogo /> 
    : disputeItem.bureau === "experian" 
      ? <ExperianLogo /> 
      : <EquifaxLogo />

  const severityInfo = SEVERITY_LABELS[disputeItem.severity]

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        side="bottom"
        className="p-0 gap-0 bg-white lg:max-w-3xl max-h-[90dvh] lg:max-h-[85vh]"
      >
        <ResponsiveModalHeader className="p-0 space-y-0">
          <div className="px-6 py-5 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div>
                  <ResponsiveModalTitle className="text-lg font-semibold text-white">
                    Review Dispute Item
                  </ResponsiveModalTitle>
                  <p className="text-sm text-slate-300 mt-0.5">Understand the issue and take action</p>
                </div>
              </div>
              <Badge className={cn(
                "text-xs px-3 py-1",
                disputeItem.severity === "high" 
                  ? "bg-red-500/20 text-red-200 border border-red-400/30" 
                  : disputeItem.severity === "medium"
                    ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                    : "bg-green-500/20 text-green-200 border border-green-400/30"
              )}>
                {severityInfo.label}
              </Badge>
            </div>
          </div>
        </ResponsiveModalHeader>

        <ScrollArea className="max-h-[60dvh] lg:max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Quick Summary Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4 w-[100%]">
                <div className="w-24 h-12 pt-2 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  {bureauIcon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {disputeItem.creditorName || CATEGORY_LABELS[disputeItem.category]}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {disputeItem.accountIdentifier && (
                      <span className="text-sm text-slate-500">
                        Account ending in <span className="font-medium text-slate-700">{disputeItem.accountIdentifier.slice(-4)}</span>
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORY_LABELS[disputeItem.category]}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Impact indicator */}
              <div className={cn(
                "mt-4 rounded-lg p-3 flex items-start gap-3",
                disputeItem.severity === "high" 
                  ? "bg-red-50 border border-red-100" 
                  : disputeItem.severity === "medium"
                    ? "bg-amber-50 border border-amber-100"
                    : "bg-green-50 border border-green-100"
              )}>
                <Info className={cn(
                  "w-4 h-4 mt-0.5 shrink-0",
                  disputeItem.severity === "high" ? "text-red-600" 
                    : disputeItem.severity === "medium" ? "text-amber-600" 
                    : "text-green-600"
                )} />
                <div>
                  <div className={cn(
                    "text-sm font-medium",
                    disputeItem.severity === "high" ? "text-red-800" 
                      : disputeItem.severity === "medium" ? "text-amber-800" 
                      : "text-green-800"
                  )}>
                    {severityInfo.description}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">{severityInfo.action}</div>
                </div>
              </div>
            </div>

            {/* Account Details - Bureau Comparison Table */}
            {(() => {
              const hasGroupedAccount = groupedAccount && (groupedAccount.transunion || groupedAccount.experian || groupedAccount.equifax);
              const hasAnyAccount = hasGroupedAccount || disputeItem.sourceAccount;
              
              if (!hasAnyAccount) {
                // No account reference - show notice
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-amber-800">No Account Reference Found</div>
                        <div className="text-xs text-amber-700 mt-1">
                          This dispute item may not be associated with a specific credit account. 
                          It could be a personal information issue, inquiry, or public record that doesn&apos;t have a traditional account structure.
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline" className="bg-white">{CATEGORY_LABELS[disputeItem.category]}</Badge>
                          <Badge variant="outline" className={cn("bg-white", SEVERITY_COLORS[disputeItem.severity].text)}>
                            {severityInfo.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Get summaries for each bureau
              const tu = getAccountCompareSummary(groupedAccount?.transunion);
              const ex = getAccountCompareSummary(groupedAccount?.experian);
              const eq = getAccountCompareSummary(groupedAccount?.equifax);

              // Row renderer with discrepancy highlighting
              const row = (label: string, tuVal: string, exVal: string, eqVal: string) => {
                const values = [tuVal, exVal, eqVal].filter(v => v !== "—");
                const hasDiscrepancy = values.length > 1 && !values.every(v => v === values[0]);
                
                return (
                  <tr key={label} className={cn("hover:bg-amber-50/40", hasDiscrepancy && "bg-amber-100/30")}>
                    <td className="py-2 px-3 text-left text-xs font-medium text-stone-600 border-r border-amber-200/80">
                      <div className="flex items-center gap-1">
                        {label}
                        {hasDiscrepancy && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                      </div>
                    </td>
                    <td className={cn(
                      "py-2 px-3 text-center text-xs text-stone-700 border-r border-amber-200/80",
                      hasDiscrepancy && tuVal !== "—" && "bg-amber-200/20"
                    )}>
                      {tuVal}
                    </td>
                    <td className={cn(
                      "py-2 px-3 text-center text-xs text-stone-700 border-r border-amber-200/80",
                      hasDiscrepancy && exVal !== "—" && "bg-amber-200/20"
                    )}>
                      {exVal}
                    </td>
                    <td className={cn(
                      "py-2 px-3 text-center text-xs text-stone-700",
                      hasDiscrepancy && eqVal !== "—" && "bg-amber-200/20"
                    )}>
                      {eqVal}
                    </td>
                  </tr>
                );
              };

              const creditorName = groupedAccount?.creditorName || accountContext?.creditorName || disputeItem.creditorName || "Unknown";
              const accountId = groupedAccount?.accountIdentifier || accountContext?.accountIdentifier || disputeItem.accountIdentifier || "";

              return (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-800 truncate">{creditorName}</div>
                      <div className="text-xs text-stone-500 truncate">
                        Account ID: <span className="font-medium text-stone-700">{accountId || "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs bg-white">{CATEGORY_LABELS[disputeItem.category]}</Badge>
                      <Badge className={cn("text-xs", SEVERITY_COLORS[disputeItem.severity].bg, SEVERITY_COLORS[disputeItem.severity].text)}>
                        {severityInfo.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Bureau Comparison Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="border-b border-amber-200/80 bg-amber-100/50">
                          <th className="py-3 px-3 text-left text-sm font-medium text-stone-600 w-[140px] border-r border-amber-200/80">
                            Field
                          </th>
                          <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[120px]">
                            <TransUnionLogo />
                          </th>
                          <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[120px]">
                            <ExperianLogo />
                          </th>
                          <th className="py-3 px-3 text-center w-[120px]">
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
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* The Issue - Enhanced with detailed explanations */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-700">What We Found</span>
              </div>
              <div className="p-5">
                {(() => {
                  const explanation = getFieldExplanation(disputeItem.fieldPath, disputeItem.value, disputeItem.reason);
                  return (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-500">Issue Type</div>
                          <div className="text-base font-semibold text-slate-900 mt-0.5">
                            {explanation.title}
                          </div>
                          <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                            <div className="text-xs text-red-600 font-medium">Current value</div>
                            <div className="text-sm text-red-800 font-semibold mt-0.5">
                              {formatDisplayValue(disputeItem.value)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-start gap-2">
                          <HelpCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs text-slate-500 font-medium mb-1">What this means</div>
                            <div className="text-sm text-slate-700 leading-relaxed">{explanation.description}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs text-slate-500 font-medium mb-1">Impact on your credit</div>
                            <div className="text-sm text-slate-700 leading-relaxed">{explanation.impact}</div>
                          </div>
                        </div>
                        
                        {disputeItem.reason && disputeItem.reason !== explanation.impact && (
                          <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-xs text-slate-500 font-medium mb-1">Why you can dispute this</div>
                              <div className="text-sm text-slate-700 leading-relaxed">{disputeItem.reason}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* AI Analysis Section - Redesigned */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-white" />
                  <span className="text-sm font-semibold text-white">AI-Powered Analysis</span>
                </div>
                {onAnalyze && disputeItem && !aiAnalysis?.loading && !aiAnalysis?.reasons?.length && (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-white text-purple-700 hover:bg-purple-50 text-xs h-7"
                    onClick={() => onAnalyze(disputeItem)}
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Analyze Item
                  </Button>
                )}
              </div>

              <div className="p-5">
                {aiAnalysis?.loading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                    </div>
                    <div className="text-sm text-slate-700 font-medium">Analyzing this item...</div>
                    <div className="text-xs text-slate-500">Finding the best dispute reasons</div>
                  </div>
                ) : aiAnalysis?.error ? (
                  <div className="rounded-lg bg-red-50 border border-red-100 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-red-800">Analysis couldn&apos;t complete</div>
                        <div className="text-xs text-red-600 mt-1">{aiAnalysis.error}</div>
                        {onAnalyze && disputeItem && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-3 text-xs h-7"
                            onClick={() => onAnalyze(disputeItem)}
                          >
                            Try Again
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : !aiAnalysis?.reasons?.length ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-sm font-medium text-slate-700">Get AI-powered dispute suggestions</div>
                    <div className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Our AI will analyze this item and suggest the most effective reasons to dispute it.
                    </div>
                  </div>
                ) : (
                <div className="space-y-4">
                  {/* Layman's Explanation */}
                  {aiAnalysis?.laymanExplanation && (
                    <div className="rounded-lg bg-purple-50 border border-purple-100 p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <Shield className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-purple-700 mb-1">What this means for you</div>
                          <div className="text-sm text-slate-700 leading-relaxed">{aiAnalysis.laymanExplanation}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Reasons */}
                  {aiAnalysis?.reasons?.length ? (
                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        Select reasons to include in your dispute letter
                      </div>
                      <div className="space-y-2">
                        {aiAnalysis.reasons.map((r) => {
                          const isExisting = existingReasons.includes(r.label)
                          const isSelected = selectedReasons.has(r.label)
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => toggleReason(r.label)}
                              disabled={isExisting}
                              className={cn(
                                "w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all",
                                isExisting
                                  ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
                                  : isSelected
                                    ? "bg-purple-100 border-purple-400 text-purple-800 ring-2 ring-purple-300"
                                    : "bg-white border-stone-200 text-stone-700 hover:border-purple-300 hover:bg-purple-50/50"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                                    isExisting
                                      ? "border-stone-300 bg-stone-200"
                                      : isSelected
                                        ? "border-purple-500 bg-purple-500"
                                        : "border-stone-300"
                                  )}>
                                    {(isSelected || isExisting) && (
                                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="font-medium">{r.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isExisting && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-500">
                                      Already added
                                    </span>
                                  )}
                                  <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded",
                                    r.confidence >= 80 ? "bg-green-100 text-green-700" :
                                    r.confidence >= 50 ? "bg-amber-100 text-amber-700" :
                                    "bg-stone-100 text-stone-600"
                                  )}>
                                    {r.confidence}% match
                                  </span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* AI Summary */}
                  {aiAnalysis?.summary && (
                    <div className="text-xs text-purple-700 italic mt-2">
                      💡 {aiAnalysis.summary}
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>

          </div>
          <ResponsiveModalFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between w-full gap-4">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-600"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              {onSendToLetter && (
                <Button
                  type="button"
                  className="bg-purple-600 hover:bg-purple-700 shadow-sm"
                  disabled={selectedReasons.size === 0 || aiAnalysis?.loading}
                  onClick={handleSendToLetter}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {selectedReasons.size > 0 
                    ? `Add ${selectedReasons.size} Reason${selectedReasons.size !== 1 ? 's' : ''} to Letter`
                    : 'Select reasons above'
                  }
                </Button>
              )}
            </div>
          </ResponsiveModalFooter>
        </ScrollArea>

      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
