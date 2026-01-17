import { Checkbox } from "@/components/atoms/checkbox";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { formatDisplayValue, shortKey } from "@/lib/utils";
import { DisputeItem } from "@/lib/dispute-fields";
import React from "react";
import { DISPUTE_REASONS } from "@/components/organisms/sections/InlineCreditReportView";

export function DisputeItemsPane({
  disputes,
  selectedDisputes,
  disputeReasons,
  onToggleDisputeSelection,
  onUpdateDisputeReasons,
  onSendToLetter,
  onSendAccountSelectedToLetter,
  className,
}: {
  disputes: DisputeItem[];
  selectedDisputes: Set<string>;
  disputeReasons: Record<string, string[]>;
  onToggleDisputeSelection: (id: string) => void;
  onUpdateDisputeReasons: (id: string, reasons: string[]) => void;
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void;
  onSendAccountSelectedToLetter: (items: DisputeItem[]) => void;
  className?: string;
}) {
  const selected = React.useMemo(() => disputes.filter((d) => selectedDisputes.has(d.id)), [disputes, selectedDisputes]);
  if (disputes.length === 0) return null;

  return (
    <details className={cn("group border-b border-stone-200", className)}>
      <summary className="px-4 py-2 bg-red-50 cursor-pointer hover:bg-red-100 text-sm font-medium text-red-700 flex items-center justify-between">
        <span>Dispute Items ({disputes.length})</span>
        {onSendToLetter && selected.length > 0 && (
          <Button
            size="sm"
            className="h-7 px-2 bg-purple-600 hover:bg-purple-700"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSendAccountSelectedToLetter(selected);
            }}
          >
            <Send className="w-3 h-3 mr-1" />
            Send ({selected.length})
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
              {onSendToLetter && selectedDisputes.has(item.id) && (
                <div className="mt-2 p-2 bg-white/50 rounded border border-stone-200">
                  <label className="text-xs font-medium text-stone-600 block mb-1">Dispute Reason(s)</label>

                  {(() => {
                    const selectedReasons = disputeReasons[item.id] ?? [];
                    const toggleReason = (reason: string) => {
                      const next = selectedReasons.includes(reason)
                        ? selectedReasons.filter((r) => r !== reason)
                        : [...selectedReasons, reason];
                      onUpdateDisputeReasons(item.id, next);
                    };

                    const renderGroup = (
                      title: string,
                      reasons: ReadonlyArray<{ id: string; label: string }>
                    ) => (
                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-stone-600">{title}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {reasons.map((r) => (
                            <label key={r.id} className="flex items-start gap-2 text-xs text-stone-700">
                              <Checkbox
                                checked={selectedReasons.includes(r.label)}
                                onCheckedChange={() => toggleReason(r.label)}
                                className="mt-0.5"
                              />
                              <span className="leading-4">{r.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );

                    return (
                      <div className="space-y-2">
                        {renderGroup("Credit Reporting Agency (CRA)", DISPUTE_REASONS.cra)}
                        {renderGroup("Creditor/Furnisher", DISPUTE_REASONS.creditor)}
                        {renderGroup("Collection Agency", DISPUTE_REASONS.collection)}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}