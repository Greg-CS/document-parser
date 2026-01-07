"use client"

import * as React from "react"

import { cn, shortKey, stringifyPrimitive } from "@/lib/utils"
import {
  extractDisputeItems,
  isNegativeValue,
  SEVERITY_COLORS,
  CATEGORY_LABELS,
  type DisputeItem,
  type DisputeCategory,
} from "@/lib/dispute-fields"
import { TransUnionLogo, EquifaxLogo, ExperianLogo } from "../icons/CreditBureauIcons"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
  ResponsiveModalTrigger,
} from "@/components/atoms/responsiveModal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/atoms/tabs"
import { Button } from "@/components/atoms/button"
import { ScrollArea } from "@/components/atoms/scroll-area"
import { Badge } from "@/components/atoms/badge"

export type BureauType = "transunion" | "experian" | "equifax"

export interface ImportedFile {
  id: string
  name: string
  kind: string
  data: Record<string, unknown>
  keys: string[]
}

export interface BureauAssignment {
  transunion: string | null
  experian: string | null
  equifax: string | null
}

interface CreditModalProps {
  importedFiles: ImportedFile[]
  assignments: BureauAssignment
  onAssign: (bureau: BureauType, fileId: string | null) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj
  const parts = path.replace(/\[\*\]/g, ".0").replace(/\[(\d+)\]/g, ".$1").split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

function normalizeTextDisplay(value: string): string {
  const withoutAt = value.replace(/^@_?/, "")
  const withSpaces = withoutAt
    .replace(/_/g, " ")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
  return withSpaces.toLowerCase()
}

function formatDisplayValue(value: unknown): string {
  if (value === undefined || value === null) return "—"
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return `[${value.length} items]`
    }
    return "{...}"
  }
  const stringValue = stringifyPrimitive(value)
  return typeof value === "string" ? normalizeTextDisplay(stringValue) : stringValue
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return "[unserializable]"
  }
}

const CLAMP_2 =
  "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"

function renderCellValue(value: unknown) {
  if (value === undefined || value === null) return "—"
  if (typeof value === "object") {
    const summary = Array.isArray(value) ? `[${value.length} items]` : "{...}"
    return (
      <details className="group inline-block text-left">
        <summary className="cursor-pointer select-none text-stone-600 underline decoration-dotted underline-offset-2">
          {summary}
        </summary>
        <pre className="mt-2 whitespace-pre-wrap wrap-break-word rounded-md bg-white/60 p-2 text-xs text-stone-700">
          {safeJsonStringify(value)}
        </pre>
      </details>
    )
  }
  const stringValue = stringifyPrimitive(value)
  const display = typeof value === "string" ? normalizeTextDisplay(stringValue) : stringValue
  return (
    <div className={cn(CLAMP_2, "wrap-break-word")} title={String(display)}>
      {display}
    </div>
  )
}

interface RowProps {
  label: string
  shortLabel: string
  values: [unknown, unknown, unknown]
  showFullKey?: boolean
}

function ReportRow({ label, shortLabel, values, showFullKey }: RowProps) {
  const displayLabel = showFullKey ? label : normalizeTextDisplay(shortLabel)
  const displayTitle = showFullKey ? label : displayLabel
  return (
    <tr className="hover:bg-amber-100/40 transition-colors">
      <td
        className="py-2 px-3 text-sm font-medium text-stone-700 border-r border-amber-200/80 align-top"
        title={displayTitle}
      >
        <div className={cn(CLAMP_2, "wrap-break-word")}>{displayLabel}</div>
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 border-r border-amber-200/80 align-top">
        {renderCellValue(values[0])}
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 border-r border-amber-200/80 align-top">
        {renderCellValue(values[1])}
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 align-top">
        {renderCellValue(values[2])}
      </td>
    </tr>
  )
}

export function CreditModal({
  importedFiles,
  assignments,
  trigger,
  open,
  onOpenChange,
}: CreditModalProps) {
  const [showFullKeys, setShowFullKeys] = React.useState(false)

  const tuFile = importedFiles.find((f) => f.id === assignments.transunion)
  const exFile = importedFiles.find((f) => f.id === assignments.experian)
  const eqFile = importedFiles.find((f) => f.id === assignments.equifax)

  const allKeys = React.useMemo(() => {
    const keySet = new Set<string>()
    if (tuFile) tuFile.keys.forEach((k) => keySet.add(k))
    if (exFile) exFile.keys.forEach((k) => keySet.add(k))
    if (eqFile) eqFile.keys.forEach((k) => keySet.add(k))
    return Array.from(keySet).sort()
  }, [tuFile, exFile, eqFile])

  const hasData = tuFile || exFile || eqFile

  // Group keys by account type
  const keysByAccountType = React.useMemo(() => {
    const groups: Record<string, string[]> = {
      "Credit Score": [],
      "Credit Liability (Accounts)": [],
      "Credit Inquiry": [],
      "Personal Information": [],
      "Credit File": [],
      "Credit Summary": [],
      "Other": [],
    }
    
    for (const key of allKeys) {
      const upperKey = key.toUpperCase()
      if (upperKey.includes("CREDIT_SCORE")) {
        groups["Credit Score"].push(key)
      } else if (upperKey.includes("CREDIT_LIABILITY")) {
        groups["Credit Liability (Accounts)"].push(key)
      } else if (upperKey.includes("CREDIT_INQUIRY")) {
        groups["Credit Inquiry"].push(key)
      } else if (upperKey.includes("BORROWER") || upperKey.includes("_RESIDENCE") || upperKey.includes("_ALIAS") || upperKey.includes("EMPLOYER")) {
        groups["Personal Information"].push(key)
      } else if (upperKey.includes("CREDIT_FILE")) {
        groups["Credit File"].push(key)
      } else if (upperKey.includes("CREDIT_SUMMARY")) {
        groups["Credit Summary"].push(key)
      } else {
        groups["Other"].push(key)
      }
    }
    
    return groups
  }, [allKeys])

  // Extract dispute items from each bureau
  const disputeItems = React.useMemo(() => {
    const items: DisputeItem[] = []
    if (tuFile) items.push(...extractDisputeItems(tuFile.data, tuFile.keys, "transunion"))
    if (exFile) items.push(...extractDisputeItems(exFile.data, exFile.keys, "experian"))
    if (eqFile) items.push(...extractDisputeItems(eqFile.data, eqFile.keys, "equifax"))
    return items
  }, [tuFile, exFile, eqFile])

  // Group disputes by category
  const disputesByCategory = React.useMemo(() => {
    const grouped: Record<DisputeCategory, DisputeItem[]> = {
      collections: [],
      chargeoffs: [],
      late_payments: [],
      inquiries: [],
      personal_info: [],
      public_records: [],
      accounts: [],
    }
    for (const item of disputeItems) {
      grouped[item.category].push(item)
    }
    return grouped
  }, [disputeItems])

  // Count by severity
  const severityCounts = React.useMemo(() => {
    return {
      high: disputeItems.filter(i => i.severity === "high").length,
      medium: disputeItems.filter(i => i.severity === "medium").length,
      low: disputeItems.filter(i => i.severity === "low").length,
    }
  }, [disputeItems])

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      {trigger && <ResponsiveModalTrigger asChild>{trigger}</ResponsiveModalTrigger>}
      <ResponsiveModalContent
        side="bottom"
        className="p-0 gap-0 bg-amber-50/95 lg:max-w-6xl max-h-[90dvh] lg:max-h-[85vh]"
      >
        <ResponsiveModalHeader className="p-0 space-y-0">
          <div className="bg-linear-to-r from-purple-900 via-purple-800 to-purple-900 px-6 py-4">
            <ResponsiveModalTitle className="text-xl font-semibold text-white tracking-wide">
              Credit Report
            </ResponsiveModalTitle>
          </div>

          <Tabs defaultValue="overview" className="flex flex-col">
            <div className="bg-linear-to-r from-purple-800/90 via-purple-700/90 to-purple-800/90 px-6">
              <TabsList className="bg-transparent h-auto p-0 gap-0">
                <TabsTrigger
                  value="overview"
                  className="m-2 border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-md"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="personal"
                  className="m-2 border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-md"
                >
                  Personal Info
                </TabsTrigger>
                <TabsTrigger
                  value="accounts"
                  className="m-2 border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-md"
                >
                  Accounts
                </TabsTrigger>
                <TabsTrigger
                  value="disputes"
                  className="m-2 border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-md"
                >
                  Disputes
                  {disputeItems.length > 0 && (
                    <Badge className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0">
                      {disputeItems.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="max-h-[60dvh] lg:max-h-[60vh]">
              <TabsContent value="overview" className="m-0 p-4 lg:p-6">
                <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-x-auto shadow-sm">
                  <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-lg font-semibold text-stone-800">
                      Credit Report Overview
                    </h2>
                    <div className="flex items-center gap-3">
                      {hasData && (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {allKeys.length} fields
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              const fieldsList = allKeys.join("\n")
                              navigator.clipboard.writeText(fieldsList)
                            }}
                          >
                            📋 Copy Fields
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setShowFullKeys(!showFullKeys)}
                      >
                        {showFullKeys ? "Short keys" : "Full keys"}
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] table-fixed">
                      <thead>
                        <tr className="border-b border-amber-200/80 bg-amber-100/30">
                          <th className="py-3 px-3 text-left text-sm font-medium text-stone-600 w-[180px] border-r border-amber-200/80">
                            Field
                          </th>
                          <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[140px]">
                            <TransUnionLogo />
                          </th>
                          <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[140px]">
                            <ExperianLogo />
                          </th>
                          <th className="py-3 px-3 text-center w-[140px]">
                            <EquifaxLogo />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-200/60">
                        {!hasData ? (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-stone-500 text-sm">
                              Import files to compare data across bureaus
                            </td>
                          </tr>
                        ) : allKeys.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-stone-500 text-sm">
                              No fields found in imported files
                            </td>
                          </tr>
                        ) : (
                          allKeys.map((key) => (
                            <ReportRow
                              key={key}
                              label={key}
                              shortLabel={shortKey(key)}
                              showFullKey={showFullKeys}
                              values={[
                                tuFile ? getValueAtPath(tuFile.data, key) : undefined,
                                exFile ? getValueAtPath(exFile.data, key) : undefined,
                                eqFile ? getValueAtPath(eqFile.data, key) : undefined,
                              ]}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="personal" className="m-0 p-4 lg:p-6">
                <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-lg font-semibold text-stone-800">
                      Personal Information
                    </h2>
                    {keysByAccountType["Personal Information"].length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {keysByAccountType["Personal Information"].length} fields
                      </Badge>
                    )}
                  </div>

                  {keysByAccountType["Personal Information"].length === 0 ? (
                    <div className="p-6 text-center text-stone-500 text-sm">
                      No personal information found in imported files.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] table-fixed">
                        <thead>
                          <tr className="border-b border-amber-200/80 bg-amber-100/30">
                            <th className="py-3 px-3 text-left text-sm font-medium text-stone-600 w-[220px] border-r border-amber-200/80">
                              Field
                            </th>
                            <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[160px]">
                              <TransUnionLogo />
                            </th>
                            <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[160px]">
                              <ExperianLogo />
                            </th>
                            <th className="py-3 px-3 text-center w-[160px]">
                              <EquifaxLogo />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {keysByAccountType["Personal Information"].map((key) => (
                            <ReportRow
                              key={key}
                              label={key}
                              shortLabel={shortKey(key)}
                              showFullKey={showFullKeys}
                              values={[
                                tuFile ? getValueAtPath(tuFile.data, key) : undefined,
                                exFile ? getValueAtPath(exFile.data, key) : undefined,
                                eqFile ? getValueAtPath(eqFile.data, key) : undefined,
                              ]}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="accounts" className="m-0 p-4 lg:p-6">
                <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-lg font-semibold text-stone-800">
                      Account Details
                    </h2>
                    {keysByAccountType["Credit Liability (Accounts)"].length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {keysByAccountType["Credit Liability (Accounts)"].length} fields
                      </Badge>
                    )}
                  </div>

                  {keysByAccountType["Credit Liability (Accounts)"].length === 0 ? (
                    <div className="p-6 text-center text-stone-500 text-sm">
                      No account data found in imported files.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] table-fixed">
                        <thead>
                          <tr className="border-b border-amber-200/80 bg-amber-100/30">
                            <th className="py-3 px-3 text-left text-sm font-medium text-stone-600 w-[150px] border-r border-amber-200/80">
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
                        <tbody>
                          {keysByAccountType["Credit Liability (Accounts)"].map((key) => (
                            <ReportRow
                              key={key}
                              label={key}
                              shortLabel={shortKey(key)}
                              showFullKey={showFullKeys}
                              values={[
                                tuFile ? getValueAtPath(tuFile.data, key) : undefined,
                                exFile ? getValueAtPath(exFile.data, key) : undefined,
                                eqFile ? getValueAtPath(eqFile.data, key) : undefined,
                              ]}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="disputes" className="m-0 p-4 lg:p-6">
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className={cn("rounded-lg border p-4", SEVERITY_COLORS.high.bg, SEVERITY_COLORS.high.border)}>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm font-medium", SEVERITY_COLORS.high.text)}>High Severity</span>
                        <span className={cn("text-2xl font-bold", SEVERITY_COLORS.high.text)}>{severityCounts.high}</span>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">Collections, charge-offs, 90+ days late</p>
                    </div>
                    <div className={cn("rounded-lg border p-4", SEVERITY_COLORS.medium.bg, SEVERITY_COLORS.medium.border)}>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm font-medium", SEVERITY_COLORS.medium.text)}>Medium Severity</span>
                        <span className={cn("text-2xl font-bold", SEVERITY_COLORS.medium.text)}>{severityCounts.medium}</span>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">60 days late, derogatory marks</p>
                    </div>
                    <div className={cn("rounded-lg border p-4", SEVERITY_COLORS.low.bg, SEVERITY_COLORS.low.border)}>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm font-medium", SEVERITY_COLORS.low.text)}>Low Severity</span>
                        <span className={cn("text-2xl font-bold", SEVERITY_COLORS.low.text)}>{severityCounts.low}</span>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">30 days late, minor issues</p>
                    </div>
                  </div>

                  {/* Disputes by Category */}
                  {disputeItems.length === 0 ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
                      <div className="text-green-600 text-lg font-medium">✓ No Dispute Items Found</div>
                      <p className="text-sm text-green-600/70 mt-1">
                        No negative items detected in the imported credit reports.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(Object.entries(disputesByCategory) as [DisputeCategory, DisputeItem[]][])
                        .filter(([, items]) => items.length > 0)
                        .map(([category, items]) => (
                          <div key={category} className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-stone-800">
                                {CATEGORY_LABELS[category]}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {items.length} item{items.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="divide-y divide-amber-200/60">
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "px-4 py-3 flex items-start gap-3",
                                    SEVERITY_COLORS[item.severity].bg
                                  )}
                                >
                                  <div className={cn(
                                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                    SEVERITY_COLORS[item.severity].badge
                                  )} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={cn("text-sm font-medium", SEVERITY_COLORS[item.severity].text)}>
                                        {item.reason}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        {item.bureau.charAt(0).toUpperCase() + item.bureau.slice(1)}
                                      </Badge>
                                    </div>
                                    {item.creditorName && (
                                      <div className="text-xs text-stone-600 mt-0.5">
                                        Creditor: {item.creditorName}
                                      </div>
                                    )}
                                    {item.accountIdentifier && (
                                      <div className="text-xs text-stone-500 mt-0.5">
                                        Account: {item.accountIdentifier}
                                      </div>
                                    )}
                                    <div className="text-xs text-stone-400 mt-1 truncate" title={item.fieldPath}>
                                      {shortKey(item.fieldPath)}: {formatDisplayValue(item.value)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </ResponsiveModalHeader>

        <ResponsiveModalFooter className="px-4 lg:px-6 py-4 border-t border-amber-200/80 bg-amber-100/30">
          <Button
            variant="outline"
            className="border-stone-300 text-stone-600"
            onClick={() => onOpenChange?.(false)}
          >
            Close
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
