import { cn, formatDisplayValue, shortKey } from '@/lib/utils'
import React from 'react'
import { CATEGORY_LABELS, DisputeCategory, DisputeItem, extractDisputeItems, SEVERITY_COLORS } from '@/lib/dispute-fields'
import { DISPUTE_REASONS } from '@/components/organisms/sections/InlineCreditReportView';
import { Checkbox } from '@/components/atoms/checkbox';
import { Badge } from '@/components/atoms/badge';
import { Send } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { ImportedFile, BureauAssignment } from '@/lib/interfaces/GlobalInterfaces';

interface DisputesTabProps {
  importedFiles: ImportedFile[];
  assignments: BureauAssignment;
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void;
}

export const DisputesTab = ({
  importedFiles,
  assignments,
  onSendToLetter,
}: DisputesTabProps) => {
  const [selectedDisputes, setSelectedDisputes] = React.useState<Set<string>>(new Set());
  const [disputeReasons, setDisputeReasons] = React.useState<Record<string, string>>({});
  const tuFile = importedFiles.find((f: { id: string; }) => f.id === assignments.transunion);
  const exFile = importedFiles.find((f: { id: string; }) => f.id === assignments.experian);
  const eqFile = importedFiles.find((f: { id: string; }) => f.id === assignments.equifax);

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
  return (
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
        <div className="overflow-x-auto max-h-[400px]">
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
        </div>
        )}
    </div>
  )
}
