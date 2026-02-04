"use client"

import * as React from "react"
import { cn, normalizeFieldName, formatDisplayValue } from "@/lib/utils"
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

interface DisputeAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  disputeItem: DisputeItem | null
  accountContext?: AccountContext
  aiAnalysis?: AIDisputeAnalysis
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void
  onAnalyze?: (item: DisputeItem) => void
  existingReasons?: string[]
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

export function DisputeAccountModal({
  open,
  onOpenChange,
  disputeItem,
  accountContext,
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
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
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

            {/* Full Account Card - Shows all account fields with disputed field highlighted */}
            {disputeItem.sourceAccount ? (
              <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-stone-600" />
                    <span className="text-sm font-semibold text-stone-700">Full Account Details</span>
                  </div>
                  <Badge variant="outline" className="text-xs">Source Context</Badge>
                </div>
                <div className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-200">
                          <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 w-1/3">Field</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-stone-500">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {Object.entries(disputeItem.sourceAccount)
                          .filter(([key]) => !key.startsWith('_') || key === '_CREDITOR')
                          .slice(0, 15)
                          .map(([key, value]) => {
                            const displayKey = normalizeFieldName(key);
                            const isDisputedField = disputeItem.fieldPath.includes(key) || 
                              disputeItem.fieldName === key ||
                              key === disputeItem.fieldName;
                            const displayValue = typeof value === 'object' && value !== null
                              ? String((value as Record<string, unknown>)['@_Name'] || 
                                (value as Record<string, unknown>)['@_Code'] ||
                                JSON.stringify(value).slice(0, 50))
                              : String(formatDisplayValue(value) ?? '—');
                            
                            return (
                              <tr 
                                key={key}
                                className={cn(
                                  "transition-colors",
                                  isDisputedField && "bg-red-50 ring-2 ring-inset ring-red-300"
                                )}
                              >
                                <td className={cn(
                                  "py-2 px-3 font-medium",
                                  isDisputedField ? "text-red-700" : "text-stone-700"
                                )}>
                                  {displayKey}
                                  {isDisputedField && (
                                    <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />
                                  )}
                                </td>
                                <td className={cn(
                                  "py-2 px-3",
                                  isDisputedField ? "text-red-700 font-medium" : "text-stone-600"
                                )}>
                                  {displayValue}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* Fallback when sourceAccount not available - show basic account info */
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ExternalLink className="w-4 h-4 text-stone-600" />
                  <span className="text-sm font-semibold text-stone-700">Account Reference</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Creditor</div>
                    <div className="font-medium text-stone-700">{disputeItem.creditorName || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Account #</div>
                    <div className="font-medium text-stone-700">{disputeItem.accountIdentifier || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Bureau</div>
                    <div className="font-medium text-stone-700 capitalize">{disputeItem.bureau}</div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Category</div>
                    <div className="font-medium text-stone-700">{CATEGORY_LABELS[disputeItem.category]}</div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Severity</div>
                    <div className={cn("font-medium", SEVERITY_COLORS[disputeItem.severity].text)}>{severityInfo.label}</div>
                  </div>
                </div>
              </div>
            )}

            {/* The Issue - Cleaner presentation */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-700">What We Found</span>
              </div>
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-500">Field with issue</div>
                    <div className="text-base font-semibold text-slate-900 mt-0.5">
                      {normalizeFieldName(disputeItem.fieldPath)}
                    </div>
                    <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                      <div className="text-xs text-red-600 font-medium">Current value</div>
                      <div className="text-sm text-red-800 font-semibold mt-0.5">
                        {formatDisplayValue(disputeItem.value)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Why this may be disputable</div>
                      <div className="text-sm text-slate-700 mt-1">{disputeItem.reason}</div>
                    </div>
                  </div>
                </div>
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

            {/* Account Context (if available) */}
            {accountContext && (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ExternalLink className="w-4 h-4 text-stone-600" />
                  <span className="text-sm font-semibold text-stone-700">Account Details</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {accountContext.accountType && (
                    <div>
                      <div className="text-xs text-stone-500">Type</div>
                      <div className="font-medium text-stone-700">{accountContext.accountType}</div>
                    </div>
                  )}
                  {accountContext.balance && (
                    <div>
                      <div className="text-xs text-stone-500">Balance</div>
                      <div className="font-medium text-stone-700">{accountContext.balance}</div>
                    </div>
                  )}
                  {accountContext.status && (
                    <div>
                      <div className="text-xs text-stone-500">Status</div>
                      <div className="font-medium text-stone-700">{accountContext.status}</div>
                    </div>
                  )}
                  {accountContext.openDate && (
                    <div>
                      <div className="text-xs text-stone-500">Open Date</div>
                      <div className="font-medium text-stone-700">{accountContext.openDate}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

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
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
