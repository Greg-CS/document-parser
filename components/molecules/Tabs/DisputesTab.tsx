import { cn, formatDisplayValue, shortKey } from '@/lib/utils'
import React from 'react'
import { CATEGORY_LABELS, DisputeItem, extractDisputeItems, extractBureauDifferentials, differentialsToDisputeItems, SEVERITY_COLORS } from '@/lib/dispute-fields'
import { DISPUTE_REASONS } from '@/components/organisms/sections/InlineCreditReportView';
import { Checkbox } from '@/components/atoms/checkbox';
import { Badge } from '@/components/atoms/badge';
import { CheckCircle2, ChevronRight, Clock, Plus, Search, Send, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { ImportedFile, BureauAssignment } from '@/lib/interfaces/GlobalInterfaces';

type DisputeRoundStatus = 'suggested' | 'created' | 'sent' | 'completed';
type DisputeRoundEntry = { round: number; status: DisputeRoundStatus; date: string; selectedReason?: string };
type DisputeProgress = { rounds: DisputeRoundEntry[] };

const STORAGE_KEY = 'dispute_progress_v1';

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
  const [activeDisputeId, setActiveDisputeId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [severityFilter, setSeverityFilter] = React.useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [progressById, setProgressById] = React.useState<Record<string, DisputeProgress>>({});

  const tuFile = importedFiles.find((f) => f.id === assignments.transunion);
  const exFile = importedFiles.find((f) => f.id === assignments.experian);
  const eqFile = importedFiles.find((f) => f.id === assignments.equifax);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, DisputeProgress>;
        if (parsed && typeof parsed === 'object') setProgressById(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressById)); } catch { /* ignore */ }
  }, [progressById]);

  const disputeItems = React.useMemo(() => {
    const items: DisputeItem[] = [];
    if (tuFile) items.push(...extractDisputeItems(tuFile.data, tuFile.keys, "transunion"));
    if (exFile) items.push(...extractDisputeItems(exFile.data, exFile.keys, "experian"));
    if (eqFile) items.push(...extractDisputeItems(eqFile.data, eqFile.keys, "equifax"));
    const differentials = extractBureauDifferentials(
      tuFile?.data, tuFile?.keys, exFile?.data, exFile?.keys, eqFile?.data, eqFile?.keys
    );
    items.push(...differentialsToDisputeItems(differentials));
    return items;
  }, [tuFile, exFile, eqFile]);

  const severityCounts = React.useMemo(() => ({
    high: disputeItems.filter(i => i.severity === "high").length,
    medium: disputeItems.filter(i => i.severity === "medium").length,
    low: disputeItems.filter(i => i.severity === "low").length,
  }), [disputeItems]);

  const getProgress = React.useCallback((id: string): DisputeProgress => {
    const p = progressById[id];
    if (p?.rounds?.length) return p;
    return { rounds: [{ round: 1, status: 'suggested', date: '' }] };
  }, [progressById]);

  const updateCurrentRound = React.useCallback((id: string, patch: Partial<DisputeRoundEntry>) => {
    setProgressById((prev) => {
      const defaultEntry: DisputeRoundEntry = { round: 1, status: 'suggested', date: '' };
      const current = prev[id]?.rounds?.length ? prev[id] : { rounds: [defaultEntry] };
      const rounds = [...current.rounds];
      rounds[rounds.length - 1] = { ...rounds[rounds.length - 1], ...patch };
      return { ...prev, [id]: { rounds } };
    });
  }, []);

  const addNextRound = React.useCallback((id: string) => {
    setProgressById((prev) => {
      const defaultEntry: DisputeRoundEntry = { round: 1, status: 'suggested', date: '' };
      const current = prev[id]?.rounds?.length ? prev[id] : { rounds: [defaultEntry] };
      const rounds: DisputeRoundEntry[] = [...current.rounds];
      const nextRound = (rounds[rounds.length - 1]?.round ?? rounds.length) + 1;
      const newEntry: DisputeRoundEntry = { round: nextRound, status: 'suggested', date: '' };
      rounds.push(newEntry);
      return { ...prev, [id]: { rounds } };
    });
  }, []);

  const toggleDisputeSelection = (id: string) => {
    setSelectedDisputes(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleSendSelectedToLetter = () => {
    if (!onSendToLetter || selectedDisputes.size === 0) return;
    const items = disputeItems.filter(item => selectedDisputes.has(item.id)).map(item => ({
      label: `${item.creditorName || "Unknown"} - ${disputeReasons[item.id] || item.reason}`,
      value: `${shortKey(item.fieldPath)}: ${formatDisplayValue(item.value)}`,
    }));
    onSendToLetter(items);
    setSelectedDisputes(new Set());
  };

  const normalizedItems = React.useMemo(() => {
    const weight = (s: DisputeItem['severity']) => (s === 'high' ? 3 : s === 'medium' ? 2 : 1);
    const items = [...disputeItems].sort((a, b) => weight(b.severity) - weight(a.severity));
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (severityFilter !== 'all' && it.severity !== severityFilter) return false;
      if (!q) return true;
      const hay = [it.reason, it.creditorName || '', it.accountIdentifier || '', it.bureau, it.category, shortKey(it.fieldPath)].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [disputeItems, query, severityFilter]);

  const activeItem = React.useMemo(() => disputeItems.find((d) => d.id === activeDisputeId) ?? null, [activeDisputeId, disputeItems]);

  React.useEffect(() => {
    if (!activeDisputeId && normalizedItems.length > 0) setActiveDisputeId(normalizedItems[0].id);
  }, [activeDisputeId, normalizedItems]);

  const bureauLabel = (b: DisputeItem['bureau'], id: string) => id.startsWith('differential-') ? 'Multiple' : b.charAt(0).toUpperCase() + b.slice(1);
  const statusTone = (s: DisputeRoundStatus) => {
    if (s === 'completed') return 'bg-green-100 text-green-800 border-green-200';
    if (s === 'sent') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s === 'created') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-stone-100 text-stone-700 border-stone-200';
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
          <span className="text-sm text-purple-800">{selectedDisputes.size} item{selectedDisputes.size !== 1 ? "s" : ""} selected</span>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={handleSendSelectedToLetter}>
            <Send className="w-4 h-4 mr-2" />Send to Letter
          </Button>
        </div>
      )}

      {disputeItems.length === 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <div className="text-green-600 text-lg font-medium">✓ No Dispute Items Found</div>
          <p className="text-sm text-green-600/70 mt-1">No negative items detected.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
            <div className="p-3 border-b border-amber-200/80 bg-amber-100/50 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-stone-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search creditor, field, bureau…" className="w-full h-9 pl-9 pr-3 rounded-md border border-amber-200 bg-white text-sm text-stone-700" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'high', 'medium', 'low'] as const).map((s) => (
                  <button key={s} onClick={() => setSeverityFilter(s)} className={cn("px-2.5 py-1 rounded border text-xs font-medium", severityFilter === s ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50")}>
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
                <Badge variant="outline" className="text-xs ml-auto">{normalizedItems.length}</Badge>
              </div>
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-amber-200/60">
              {normalizedItems.map((item) => {
                const isActive = item.id === activeDisputeId;
                const progress = getProgress(item.id);
                const current = progress.rounds[progress.rounds.length - 1];
                return (
                  <button key={item.id} type="button" onClick={() => setActiveDisputeId(item.id)} className={cn("w-full text-left px-3 py-3 flex items-start gap-3 hover:bg-amber-50/60", isActive && "bg-white ring-2 ring-purple-400 ring-inset")}>
                    {onSendToLetter ? <Checkbox checked={selectedDisputes.has(item.id)} onCheckedChange={() => toggleDisputeSelection(item.id)} className="mt-1" /> : null}
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", SEVERITY_COLORS[item.severity].badge)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className={cn("text-sm font-semibold truncate", SEVERITY_COLORS[item.severity].text)}>{item.creditorName || CATEGORY_LABELS[item.category]}</div>
                          <div className="text-xs text-stone-500 truncate">{item.reason}</div>
                        </div>
                        <ChevronRight className={cn("w-4 h-4 shrink-0", isActive ? "text-purple-600" : "text-stone-400")} />
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{bureauLabel(item.bureau, item.id)}</Badge>
                        {item.accountIdentifier ? <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.accountIdentifier}</Badge> : null}
                        <span className={cn("text-[10px] px-2 py-0.5 rounded border", statusTone(current.status))}>Round {current.round}: {current.status}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200/80 bg-white overflow-hidden shadow-sm">
            {!activeItem ? (
              <div className="p-6 text-center text-stone-600">Select a dispute item to view details.</div>
            ) : (() => {
              const progress = getProgress(activeItem.id);
              const current = progress.rounds[progress.rounds.length - 1];
              const selectedReason = disputeReasons[activeItem.id] || current.selectedReason || '';
              const showSource = Boolean(activeItem.creditorName || activeItem.accountIdentifier);
              return (
                <div className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={cn("w-2 h-2 rounded-full", SEVERITY_COLORS[activeItem.severity].badge)} />
                        <h3 className="text-base font-semibold text-stone-900">{activeItem.creditorName || activeItem.reason}</h3>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{CATEGORY_LABELS[activeItem.category]}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{bureauLabel(activeItem.bureau, activeItem.id)}</Badge>
                      </div>
                      <div className="text-xs text-stone-600 mt-1"><span className="font-medium">Field</span>: {shortKey(activeItem.fieldPath)}</div>
                      <div className="text-xs text-stone-500 mt-0.5 wrap-break-word"><span className="font-medium">Value</span>: {formatDisplayValue(activeItem.value)}</div>
                      {showSource && (
                        <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 flex items-center gap-2 flex-wrap">
                          <ShieldAlert className="w-4 h-4 text-stone-600" /><span className="font-semibold">Source</span>
                          {activeItem.creditorName && <span>{activeItem.creditorName}</span>}
                          {activeItem.accountIdentifier && <span className="text-stone-500">({activeItem.accountIdentifier})</span>}
                        </div>
                      )}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => addNextRound(activeItem.id)}>
                      <Plus className="w-4 h-4 mr-1" />Next round
                    </Button>
                  </div>

                  <div className="rounded-lg border border-stone-200 overflow-hidden">
                    <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                      <div className="text-xs font-semibold text-stone-700">Dispute rounds</div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Track status</div>
                    </div>
                    <div className="divide-y divide-stone-200">
                      {progress.rounds.map((r) => (
                        <div key={r.round} className="px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[11px] px-2 py-0.5 rounded border", statusTone(r.status))}>Round {r.round}: {r.status}</span>
                            {r.date && <span className="text-xs text-stone-500">{r.date}</span>}
                          </div>
                          {r.round === current.round && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <select className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700" value={current.status} onChange={(e) => updateCurrentRound(activeItem.id, { status: e.target.value as DisputeRoundStatus })}>
                                <option value="suggested">Suggested</option>
                                <option value="created">Created</option>
                                <option value="sent">Sent</option>
                                <option value="completed">Completed</option>
                              </select>
                              <input className="h-8 w-[120px] rounded border border-stone-300 bg-white px-2 text-xs text-stone-700" placeholder="Date" value={current.date} onChange={(e) => updateCurrentRound(activeItem.id, { date: e.target.value })} />
                              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => updateCurrentRound(activeItem.id, { status: 'completed' })}>
                                <CheckCircle2 className="w-4 h-4 mr-1" />Complete
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <label className="text-xs font-medium text-stone-700 block mb-2">Selected dispute reason</label>
                    <select className="w-full h-9 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700" value={selectedReason} onChange={(e) => { setDisputeReasons(prev => ({ ...prev, [activeItem.id]: e.target.value })); updateCurrentRound(activeItem.id, { selectedReason: e.target.value }); }}>
                      <option value="">Select a reason...</option>
                      <optgroup label="Credit Reporting Agency (CRA)">{DISPUTE_REASONS.cra.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}</optgroup>
                      <optgroup label="Creditor/Furnisher">{DISPUTE_REASONS.creditor.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}</optgroup>
                      <optgroup label="Collection Agency">{DISPUTE_REASONS.collection.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}</optgroup>
                    </select>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
