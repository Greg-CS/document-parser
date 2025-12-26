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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/atoms/select"
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

interface CreditTrilogyModalProps {
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

function formatDisplayValue(value: unknown): string {
  if (value === undefined || value === null) return "—"
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return `[${value.length} items]`
    }
    return "{...}"
  }
  return stringifyPrimitive(value)
}

interface RowProps {
  label: string
  shortLabel: string
  values: [string, string, string]
  showFullKey?: boolean
}

function TrilogyRow({ label, shortLabel, values, showFullKey }: RowProps) {
  return (
    <tr className="hover:bg-amber-100/40 transition-colors">
      <td
        className="py-2 px-3 text-sm font-medium text-stone-700 border-r border-amber-200/80 max-w-[250px] truncate"
        title={label}
      >
        {showFullKey ? label : shortLabel}
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 border-r border-amber-200/80 max-w-[180px] truncate" title={values[0]}>
        {values[0]}
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 border-r border-amber-200/80 max-w-[180px] truncate" title={values[1]}>
        {values[1]}
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 max-w-[180px] truncate" title={values[2]}>
        {values[2]}
      </td>
    </tr>
  )
}

function TransUnionLogo() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-base font-bold text-blue-600 tracking-tight">TransUnion</span>
      <span className="text-[10px] text-blue-500">®</span>
    </div>
  )
}

function ExperianLogo() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-base font-bold tracking-tight">
        <span className="text-blue-800">ex</span>
        <span className="text-red-600">perian</span>
      </span>
      <span className="text-[10px] text-red-500">®</span>
    </div>
  )
}

function EquifaxLogo() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-base font-bold tracking-wider text-red-700">
        EQUIFAX
      </span>
      <span className="text-[10px] text-red-600">®</span>
    </div>
  )
}

function BureauSelector({
  bureau,
  bureauLabel,
  files,
  selectedFileId,
  onSelect,
}: {
  bureau: BureauType
  bureauLabel: React.ReactNode
  files: ImportedFile[]
  selectedFileId: string | null
  onSelect: (fileId: string | null) => void
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {bureauLabel}
      <Select
        value={selectedFileId ?? "none"}
        onValueChange={(v) => onSelect(v === "none" ? null : v)}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs bg-white border-amber-300">
          <SelectValue placeholder="Select file..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No file</span>
          </SelectItem>
          {files.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              <span className="truncate max-w-[140px]">{f.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function CreditTrilogyModal({
  importedFiles,
  assignments,
  onAssign,
  trigger,
  open,
  onOpenChange,
}: CreditTrilogyModalProps) {
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
          <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 px-6 py-4">
            <ResponsiveModalTitle className="text-xl font-semibold text-white tracking-wide">
              Trilogy Credit
            </ResponsiveModalTitle>
          </div>

          <Tabs defaultValue="overview" className="flex flex-col">
            <div className="bg-gradient-to-r from-purple-800/90 via-purple-700/90 to-purple-800/90 px-6">
              <TabsList className="bg-transparent h-auto p-0 gap-0">
                <TabsTrigger
                  value="overview"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="personal"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium"
                >
                  Personal Info
                </TabsTrigger>
                <TabsTrigger
                  value="accounts"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium"
                >
                  Accounts
                </TabsTrigger>
                <TabsTrigger
                  value="disputes"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium"
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
                <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-lg font-semibold text-stone-800">
                      Trilogy Overview
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
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="border-b border-amber-200/80 bg-amber-100/30">
                          <th className="py-3 px-3 text-left text-sm font-medium text-stone-600 w-[250px] border-r border-amber-200/80">
                            Field
                          </th>
                          <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[200px]">
                            <BureauSelector
                              bureau="transunion"
                              bureauLabel={<TransUnionLogo />}
                              files={importedFiles}
                              selectedFileId={assignments.transunion}
                              onSelect={(id) => onAssign("transunion", id)}
                            />
                          </th>
                          <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[200px]">
                            <BureauSelector
                              bureau="experian"
                              bureauLabel={<ExperianLogo />}
                              files={importedFiles}
                              selectedFileId={assignments.experian}
                              onSelect={(id) => onAssign("experian", id)}
                            />
                          </th>
                          <th className="py-3 px-3 text-center w-[200px]">
                            <BureauSelector
                              bureau="equifax"
                              bureauLabel={<EquifaxLogo />}
                              files={importedFiles}
                              selectedFileId={assignments.equifax}
                              onSelect={(id) => onAssign("equifax", id)}
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-200/60">
                        {!hasData ? (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-stone-500 text-sm">
                              Import files and assign them to bureaus above to compare data
                            </td>
                          </tr>
                        ) : allKeys.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-stone-500 text-sm">
                              No fields found in assigned files
                            </td>
                          </tr>
                        ) : (
                          allKeys.map((key) => (
                            <TrilogyRow
                              key={key}
                              label={key}
                              shortLabel={shortKey(key)}
                              showFullKey={showFullKeys}
                              values={[
                                formatDisplayValue(tuFile ? getValueAtPath(tuFile.data, key) : undefined),
                                formatDisplayValue(exFile ? getValueAtPath(exFile.data, key) : undefined),
                                formatDisplayValue(eqFile ? getValueAtPath(eqFile.data, key) : undefined),
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
                <div className="rounded-lg border border-amber-200/80 bg-amber-50 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-stone-800 mb-4">
                    Personal Information
                  </h2>
                  <p className="text-sm text-stone-500">
                    Personal information comparison will appear here after import.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="accounts" className="m-0 p-4 lg:p-6">
                <div className="rounded-lg border border-amber-200/80 bg-amber-50 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-stone-800 mb-4">
                    Account Details
                  </h2>
                  <p className="text-sm text-stone-500">
                    Individual account details will appear here after import.
                  </p>
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

export function CreditTrilogyTriggerButton({
  onClick,
  fileCount,
}: {
  onClick?: () => void
  fileCount?: number
}) {
  return (
    <Button
      variant="outline"
      className="bg-gradient-to-r from-purple-700 to-purple-800 text-white border-purple-900 hover:from-purple-800 hover:to-purple-900 hover:text-white"
      onClick={onClick}
    >
      View Credit Trilogy
      {fileCount !== undefined && fileCount > 0 && (
        <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
          {fileCount}
        </Badge>
      )}
    </Button>
  )
}
