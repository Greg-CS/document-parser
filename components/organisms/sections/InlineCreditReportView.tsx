"use client";

import * as React from "react";
import { AlertCircle, Send } from "lucide-react";

import { cn, formatDisplayValue, getValueAtPath, hasDerogratoryIndicator, shortKey } from "@/lib/utils";
import {
  extractDisputeItems,
  SEVERITY_COLORS,
  CATEGORY_LABELS,
  type DisputeItem,
  type DisputeCategory,
} from "@/lib/dispute-fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/atoms/tabs";
import { Button } from "@/components/atoms/button";
import { ScrollArea } from "@/components/atoms/scroll-area";
import { Badge } from "@/components/atoms/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/atoms/tooltip";
import { Checkbox } from "@/components/atoms/checkbox";
import { TransUnionLogo, EquifaxLogo, ExperianLogo } from "@/components/molecules/icons/CreditBureauIcons";

import type { ImportedFile, BureauAssignment } from "@/lib/interfaces/GlobalInterfaces";
import { AccountsTab } from "../../molecules/Tabs/AccountTab";
import { ReportRow } from "../../molecules/TableAssets/ReportRow";
import { PersonalInfoTab } from "../../molecules/Tabs/PersonalInfoTab";
import { AccountCategory } from "@/lib/types/Global";

// Business credit dispute reasons
export const DISPUTE_REASONS = {
  cra: [
    { id: "not_mine", label: "Account does not belong to my business" },
    { id: "paid_in_full", label: "Account was paid in full" },
    { id: "incorrect_balance", label: "Balance is incorrect" },
    { id: "incorrect_status", label: "Account status is incorrect" },
    { id: "duplicate", label: "Duplicate account" },
    { id: "outdated", label: "Information is outdated" },
    { id: "identity_theft", label: "Fraudulent account (identity theft)" },
  ],
  creditor: [
    { id: "never_late", label: "Never late on this account" },
    { id: "settled", label: "Account was settled" },
    { id: "bankruptcy_discharged", label: "Discharged in bankruptcy" },
    { id: "statute_of_limitations", label: "Beyond statute of limitations" },
    { id: "incorrect_creditor", label: "Wrong creditor listed" },
    { id: "paid_before_chargeoff", label: "Paid before charge-off" },
  ],
  collection: [
    { id: "no_validation", label: "Debt not validated" },
    { id: "paid_collection", label: "Collection was paid" },
    { id: "medical_debt", label: "Medical debt under $500" },
    { id: "wrong_amount", label: "Collection amount is wrong" },
  ],
} as const;

// Account type colors - exported for use in accounts tab
export const ACCOUNT_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  revolving: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  installment: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  mortgage: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  open: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700" },
  collection: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  unknown: { bg: "bg-stone-50", border: "border-stone-200", text: "text-stone-700" },
};

export function getAccountTypeColor(accountType: string) {
  const normalized = accountType.toLowerCase();
  if (normalized.includes("revolv")) return ACCOUNT_TYPE_COLORS.revolving;
  if (normalized.includes("install")) return ACCOUNT_TYPE_COLORS.installment;
  if (normalized.includes("mortgage") || normalized.includes("real estate")) return ACCOUNT_TYPE_COLORS.mortgage;
  if (normalized.includes("open")) return ACCOUNT_TYPE_COLORS.open;
  if (normalized.includes("collection")) return ACCOUNT_TYPE_COLORS.collection;
  return ACCOUNT_TYPE_COLORS.unknown;
}

interface InlineCreditReportViewProps {
  importedFiles: ImportedFile[];
  assignments: BureauAssignment;
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void;
}

export function InlineCreditReportView({
  importedFiles,
  assignments,
  onSendToLetter,
}: InlineCreditReportViewProps) {
  const [selectedDisputes, setSelectedDisputes] = React.useState<Set<string>>(new Set());
  const [disputeReasons, setDisputeReasons] = React.useState<Record<string, string>>({});
  const [showFullKeys, setShowFullKeys] = React.useState(false);

  const tuFile = importedFiles.find((f) => f.id === assignments.transunion);
  const exFile = importedFiles.find((f) => f.id === assignments.experian);
  const eqFile = importedFiles.find((f) => f.id === assignments.equifax);

  const hasDerogatory = React.useMemo(() => {
    if (tuFile && hasDerogratoryIndicator(tuFile.data, tuFile.keys)) return true;
    if (exFile && hasDerogratoryIndicator(exFile.data, exFile.keys)) return true;
    if (eqFile && hasDerogratoryIndicator(eqFile.data, eqFile.keys)) return true;
    return false;
  }, [tuFile, exFile, eqFile]);

  const allKeys = React.useMemo(() => {
    const keySet = new Set<string>();
    if (tuFile) tuFile.keys.forEach((k: string) => keySet.add(k));
    if (exFile) exFile.keys.forEach((k: string) => keySet.add(k));
    if (eqFile) eqFile.keys.forEach((k: string) => keySet.add(k));
    return Array.from(keySet).sort();
  }, [tuFile, exFile, eqFile]);

  const hasData = tuFile || exFile || eqFile;

  const disputeItems = React.useMemo(() => {
    const items: DisputeItem[] = [];
    if (tuFile) items.push(...extractDisputeItems(tuFile.data, tuFile.keys, "transunion"));
    if (exFile) items.push(...extractDisputeItems(exFile.data, exFile.keys, "experian"));
    if (eqFile) items.push(...extractDisputeItems(eqFile.data, eqFile.keys, "equifax"));
    return items;
  }, [tuFile, exFile, eqFile]);

  const disputesByCategory = React.useMemo(() => {
    const grouped: Record<DisputeCategory, DisputeItem[]> = {
      collections: [],
      chargeoffs: [],
      late_payments: [],
      inquiries: [],
      personal_info: [],
      public_records: [],
      accounts: [],
    };
    for (const item of disputeItems) {
      grouped[item.category].push(item);
    }
    return grouped;
  }, [disputeItems]);

  const severityCounts = React.useMemo(() => ({
    high: disputeItems.filter(i => i.severity === "high").length,
    medium: disputeItems.filter(i => i.severity === "medium").length,
    low: disputeItems.filter(i => i.severity === "low").length,
  }), [disputeItems]);

  const toggleDisputeSelection = (id: string) => {
    setSelectedDisputes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendSelectedToLetter = () => {
    if (!onSendToLetter || selectedDisputes.size === 0) return;
    const items = disputeItems
      .filter(item => selectedDisputes.has(item.id))
      .map(item => ({
        label: `${item.creditorName || "Unknown"} - ${disputeReasons[item.id] || item.reason}`,
        value: `${shortKey(item.fieldPath)}: ${formatDisplayValue(item.value)}`,
      }));
    onSendToLetter(items);
    setSelectedDisputes(new Set());
  };

  if (!hasData) {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-12 text-center">
        <div className="text-stone-500 text-sm">Import a credit report file to view the analysis</div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-stone-200 overflow-hidden">
      {hasDerogatory && (
        <div className="absolute top-0 right-0 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-bl-lg shadow-lg">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Derogatory</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>This report contains derogatory data indicators</TooltipContent>
          </Tooltip>
        </div>
      )}

      <Tabs defaultValue="overview" className="flex flex-col">
        <div className="bg-linear-to-r from-purple-900 via-purple-800 to-purple-900 px-4 py-3">
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="overview" className="border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-none">
              Overview
            </TabsTrigger>
            <TabsTrigger value="personal" className="border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-none">
              Personal Info
            </TabsTrigger>
            <TabsTrigger value="accounts" className="border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-none">
              Accounts
            </TabsTrigger>
            <TabsTrigger value="disputes" className="border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-none">
              Disputes
              {disputeItems.length > 0 && (
                <Badge className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0">{disputeItems.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="bg-amber-50/50">
          <TabsContent value="overview" className="m-0 p-4 lg:p-6">
            <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-stone-800">Credit Report Overview</h2>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">{allKeys.length} fields</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      const fieldsList = allKeys.join("\n");
                      navigator.clipboard.writeText(fieldsList);
                    }}
                  >
                    📋 Copy Fields
                  </Button>
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

              <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
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
                    {allKeys.map((key) => (
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
            </div>
          </TabsContent>

          <TabsContent value="personal" className="m-0 p-4 lg:p-6">
            <PersonalInfoTab tuFile={tuFile} exFile={exFile} eqFile={eqFile} showFullKeys={showFullKeys} />
          </TabsContent>

          <TabsContent value="accounts" className="m-0 p-4 lg:p-6">
            <AccountsTab tuFile={tuFile} exFile={exFile} eqFile={eqFile} showFullKeys={showFullKeys} />
          </TabsContent>

          <TabsContent value="disputes" className="m-0 p-4">
            <div className="space-y-4">
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

              {onSendToLetter && selectedDisputes.size > 0 && (
                <div className="flex items-center justify-between bg-purple-100 border border-purple-200 rounded-lg px-4 py-3">
                  <span className="text-sm text-purple-800">
                    {selectedDisputes.size} item{selectedDisputes.size !== 1 ? "s" : ""} selected
                  </span>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={handleSendSelectedToLetter}>
                    <Send className="w-4 h-4 mr-2" />
                    Send to Letter
                  </Button>
                </div>
              )}

              {disputeItems.length === 0 ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
                  <div className="text-green-600 text-lg font-medium">✓ No Dispute Items Found</div>
                  <p className="text-sm text-green-600/70 mt-1">No negative items detected.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-4">
                    {(Object.entries(disputesByCategory) as [DisputeCategory, DisputeItem[]][])
                      .filter(([, items]) => items.length > 0)
                      .map(([category, items]) => (
                        <div key={category} className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
                          <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-stone-800">{CATEGORY_LABELS[category]}</h3>
                            <Badge variant="outline" className="text-xs">{items.length}</Badge>
                          </div>
                          <div className="divide-y divide-amber-200/60">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className={cn(
                                  "px-4 py-3 flex items-start gap-3",
                                  SEVERITY_COLORS[item.severity].bg,
                                  selectedDisputes.has(item.id) && "ring-2 ring-purple-400 ring-inset"
                                )}
                              >
                                {onSendToLetter && (
                                  <Checkbox
                                    checked={selectedDisputes.has(item.id)}
                                    onCheckedChange={() => toggleDisputeSelection(item.id)}
                                    className="mt-1"
                                  />
                                )}
                                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", SEVERITY_COLORS[item.severity].badge)} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn("text-sm font-medium", SEVERITY_COLORS[item.severity].text)}>{item.reason}</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {item.bureau.charAt(0).toUpperCase() + item.bureau.slice(1)}
                                    </Badge>
                                  </div>
                                  {item.creditorName && <div className="text-xs text-stone-600 mt-0.5">Creditor: {item.creditorName}</div>}
                                  <div className="text-xs text-stone-400 mt-1 truncate">{shortKey(item.fieldPath)}: {formatDisplayValue(item.value)}</div>
                                  {selectedDisputes.has(item.id) && (
                                    <div className="mt-2 p-2 bg-white/50 rounded border border-stone-200">
                                      <label className="text-xs font-medium text-stone-600 block mb-1">Dispute Reason</label>
                                      <select
                                        className="w-full h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700"
                                        value={disputeReasons[item.id] || ""}
                                        onChange={(e) => setDisputeReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                                      >
                                        <option value="">Select a reason...</option>
                                        <optgroup label="Credit Reporting Agency (CRA)">
                                          {DISPUTE_REASONS.cra.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}
                                        </optgroup>
                                        <optgroup label="Creditor/Furnisher">
                                          {DISPUTE_REASONS.creditor.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}
                                        </optgroup>
                                        <optgroup label="Collection Agency">
                                          {DISPUTE_REASONS.collection.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}
                                        </optgroup>
                                      </select>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
