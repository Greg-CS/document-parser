import { cn, formatDisplayValue, shortKey, normalizeFieldName } from '@/lib/utils'
import React from 'react'
import { CATEGORY_LABELS, DisputeItem, extractDisputeItems, extractBureauDifferentials, differentialsToDisputeItems, SEVERITY_COLORS } from '@/lib/dispute-fields'
import { DISPUTE_REASONS } from '@/components/organisms/sections/InlineCreditReportView';
import { Checkbox } from '@/components/atoms/checkbox';
import { Badge } from '@/components/atoms/badge';
import { CheckCircle2, ChevronRight, Clock, Eye, Plus, Search, Send, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { ImportedFile, BureauAssignment } from '@/lib/interfaces/GlobalInterfaces';
import { DisputeAccountModal } from '@/components/molecules/modal/DisputeAccountModal';

type DisputeRoundStatus = 'suggested' | 'created' | 'sent' | 'completed';
type DisputeRoundEntry = { round: number; status: DisputeRoundStatus; date: string; selectedReason?: string };
type DisputeProgress = { rounds: DisputeRoundEntry[] };
// Global progress tracks which items are selected for the current round
type GlobalDisputeProgress = { rounds: DisputeRoundEntry[]; selectedItemIds: string[] };

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
  // Global progress for dispute rounds (applies to entire file)
  const [globalProgress, setGlobalProgress] = React.useState<GlobalDisputeProgress>({
    rounds: [{ round: 1, status: 'suggested', date: '' }],
    selectedItemIds: []
  });
  const [aiReasonById, setAiReasonById] = React.useState<Record<string, { 
    reasons: Array<{ id: string; label: string; confidence: number }>; 
    summary: string; 
    laymanExplanation: string;
    loading: boolean; 
    thinkingHarder: boolean;
    error?: string 
  }>>({});
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalItem, setModalItem] = React.useState<DisputeItem | null>(null);
  const [addedReasonsByAccount, setAddedReasonsByAccount] = React.useState<Record<string, string[]>>({});
  const [roundsGated, setRoundsGated] = React.useState(true);
  const [newerUploadInfo, setNewerUploadInfo] = React.useState<{ id: string; filename: string } | null>(null);
  const [showSummary, setShowSummary] = React.useState(true);
  const [aiSummary, setAiSummary] = React.useState<{
    text: string;
    loading: boolean;
    error?: string;
    itemsHash?: string;
  }>({ text: '', loading: false });

  const tuFile = importedFiles.find((f) => f.id === assignments.transunion);
  const exFile = importedFiles.find((f) => f.id === assignments.experian);
  const eqFile = importedFiles.find((f) => f.id === assignments.equifax);

  // Check if newer similar upload exists to gate dispute rounds
  React.useEffect(() => {
    const checkNewer = async () => {
      const primaryFile = tuFile || exFile || eqFile;
      if (!primaryFile?.documentId || !primaryFile?.fingerprint) {
        setRoundsGated(true);
        setNewerUploadInfo(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/disputes/check-newer-upload?documentId=${primaryFile.documentId}&fingerprint=${primaryFile.fingerprint}`
        );
        const data = await res.json();
        if (res.ok && data.hasNewer && data.newerDocument) {
          setRoundsGated(false);
          setNewerUploadInfo({ id: data.newerDocument.id, filename: data.newerDocument.filename });
        } else {
          setRoundsGated(true);
          setNewerUploadInfo(null);
        }
      } catch {
        setRoundsGated(true);
        setNewerUploadInfo(null);
      }
    };
    checkNewer();
  }, [tuFile, exFile, eqFile]);

  // Load global progress from localStorage
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GlobalDisputeProgress;
        if (parsed && parsed.rounds?.length) setGlobalProgress(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  // Save global progress to localStorage
  React.useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(globalProgress)); } catch { /* ignore */ }
  }, [globalProgress]);

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

  // Create a hash of dispute items for memoization
  const itemsHash = React.useMemo(() => {
    if (disputeItems.length === 0) return '';
    return disputeItems.map(i => `${i.id}:${i.severity}`).join('|');
  }, [disputeItems]);

  // Fetch AI-generated summary (memoized - only fetches when items change)
  const fetchAiSummary = React.useCallback(async () => {
    if (!disputeItems.length || aiSummary.itemsHash === itemsHash) return;
    
    setAiSummary(prev => ({ ...prev, loading: true, error: undefined }));
    
    try {
      const response = await fetch('/api/disputes/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: disputeItems.slice(0, 20).map(i => ({
            category: i.category,
            severity: i.severity,
            creditorName: i.creditorName,
            fieldName: i.fieldName,
            reason: i.reason,
          })),
          counts: severityCounts,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to generate summary');
      
      const data = await response.json();
      setAiSummary({
        text: data.summary || '',
        loading: false,
        itemsHash,
      });
    } catch (err) {
      setAiSummary(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to generate summary',
      }));
    }
  }, [disputeItems, severityCounts, itemsHash, aiSummary.itemsHash]);

  // Global round (applies to entire file, not per-item)
  const _currentGlobalRound = globalProgress.rounds[globalProgress.rounds.length - 1]; // Reserved for future use

  const updateGlobalRound = React.useCallback((patch: Partial<DisputeRoundEntry>) => {
    setGlobalProgress((prev) => {
      const rounds = [...prev.rounds];
      rounds[rounds.length - 1] = { ...rounds[rounds.length - 1], ...patch };
      return { ...prev, rounds };
    });
  }, []);

  const addNextGlobalRound = React.useCallback(() => {
    setGlobalProgress((prev) => {
      const rounds = [...prev.rounds];
      const nextRound = (rounds[rounds.length - 1]?.round ?? rounds.length) + 1;
      const newEntry: DisputeRoundEntry = { round: nextRound, status: 'suggested', date: '' };
      rounds.push(newEntry);
      return { ...prev, rounds };
    });
  }, []);

  // Kept for backward compatibility with existing UI elements
  const getProgress = React.useCallback((_id: string): DisputeProgress => {
    // Now using global progress instead of per-item
    return globalProgress;
  }, [globalProgress]);

  const updateCurrentRound = React.useCallback((_id: string, patch: Partial<DisputeRoundEntry>) => {
    updateGlobalRound(patch);
  }, [updateGlobalRound]);

  const addNextRound = React.useCallback((_id: string) => {
    addNextGlobalRound();
  }, [addNextGlobalRound]);

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

  const suggestReason = React.useCallback(async (item: DisputeItem, thinkHarder = false) => {
    const dispute = {
      id: item.id,
      category: item.category,
      bureau: item.bureau,
      fieldPath: item.fieldPath,
      value: item.value,
      reason: item.reason,
      creditorName: item.creditorName,
      accountIdentifier: item.accountIdentifier,
      severity: item.severity,
    };

    const options = [
      ...DISPUTE_REASONS.cra.map((r) => ({ id: r.id, label: r.label, group: 'cra' as const })),
      ...DISPUTE_REASONS.creditor.map((r) => ({ id: r.id, label: r.label, group: 'creditor' as const })),
      ...DISPUTE_REASONS.collection.map((r) => ({ id: r.id, label: r.label, group: 'collection' as const })),
    ];

    const prev = aiReasonById[item.id];
    setAiReasonById((p) => ({
      ...p,
      [item.id]: { 
        reasons: prev?.reasons ?? [], 
        summary: prev?.summary ?? '', 
        laymanExplanation: prev?.laymanExplanation ?? '',
        loading: true, 
        thinkingHarder: thinkHarder 
      },
    }));

    try {
      const res = await fetch('/api/disputes/suggest-reason', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dispute, options, multipleReasons: true, thinkHarder, includeLaymanExplanation: true }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `Failed to suggest reason (${res.status})`);
      }

      const data = (await res.json()) as { 
        selected?: { id: string; label: string }; 
        reasons?: Array<{ id: string; label: string; confidence: number }>;
        summary?: string;
        laymanExplanation?: string;
      };
      
      // Support both single and multiple reasons from API
      const reasons = data.reasons ?? (data.selected ? [{ ...data.selected, confidence: 100 }] : []);
      const primaryLabel = reasons[0]?.label ?? '';
      
      if (primaryLabel) {
        setDisputeReasons((p) => ({ ...p, [item.id]: primaryLabel }));
      }

      setAiReasonById((p) => ({
        ...p,
        [item.id]: { 
          reasons, 
          summary: data.summary ?? '', 
          laymanExplanation: data.laymanExplanation ?? generateLaymanExplanation(item),
          loading: false, 
          thinkingHarder: false 
        },
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to suggest reason';
      setAiReasonById((p) => ({
        ...p,
        [item.id]: { 
          reasons: prev?.reasons ?? [], 
          summary: prev?.summary ?? '', 
          laymanExplanation: prev?.laymanExplanation ?? '',
          loading: false, 
          thinkingHarder: false,
          error: message 
        },
      }));
    }
  }, [aiReasonById]);

  // Generate layman explanation if API doesn't provide one
  const generateLaymanExplanation = (item: DisputeItem): string => {
    const severityText = item.severity === 'high' 
      ? 'This is seriously hurting your credit score right now.' 
      : item.severity === 'medium' 
        ? 'This is moderately affecting your credit score.' 
        : 'This is a minor issue but still worth fixing.';
    
    const categoryExplanations: Record<string, string> = {
      collections: 'A debt collector is claiming you owe money. This shows up as a major negative mark.',
      chargeoffs: 'A creditor gave up trying to collect and wrote off your debt. This is one of the worst marks you can have.',
      late_payments: 'Late payments stay on your report for 7 years and lower your score each time.',
      inquiries: 'Too many hard inquiries can make you look desperate for credit.',
      personal_info: 'Incorrect personal info can cause identity mix-ups or fraud issues.',
      public_records: 'Public records like bankruptcies or judgments are serious negative marks.',
      accounts: 'There may be errors in how this account is being reported.',
    };
    
    return `${categoryExplanations[item.category] || 'This item may contain errors.'} ${severityText}`;
  };

  const openItemModal = (item: DisputeItem) => {
    setModalItem(item);
    setModalOpen(true);
    // Don't auto-trigger AI - let user click button to save API tokens
  };

  const handleModalSendToLetter = (items: Array<{ label: string; value: string }>) => {
    if (!onSendToLetter || !modalItem) return;
    
    // Track added reasons per account to prevent duplicates
    const accountKey = `${modalItem.creditorName || 'unknown'}-${modalItem.accountIdentifier || 'unknown'}`;
    const newReasons = items.map(i => i.label);
    
    setAddedReasonsByAccount(prev => ({
      ...prev,
      [accountKey]: [...(prev[accountKey] || []), ...newReasons]
    }));
    
    onSendToLetter(items);
  };

  const getExistingReasonsForItem = (item: DisputeItem): string[] => {
    const accountKey = `${item.creditorName || 'unknown'}-${item.accountIdentifier || 'unknown'}`;
    return addedReasonsByAccount[accountKey] || [];
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

  // REMOVED: Auto-suggest AI reasons - now only triggered when user clicks "Get AI Suggestion"
  // This saves API tokens by not auto-calling on every view

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

      {/* Summary Section - Overview of all items by severity */}
      {disputeItems.length > 0 && (
        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSummary(!showSummary)}
            className="w-full px-4 py-3 flex items-center justify-between bg-stone-50 border-b border-stone-200 hover:bg-stone-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-stone-600" />
              <span className="text-sm font-semibold text-stone-800">Dispute Summary & Guidance</span>
            </div>
            <ChevronRight className={cn("w-4 h-4 text-stone-500 transition-transform", showSummary && "rotate-90")} />
          </button>
          {showSummary && <div className="p-4 space-y-4">
            {/* AI-Generated Summary */}
            <div className="rounded-md border border-purple-200 bg-purple-50 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700 border-purple-300">AI Summary</Badge>
                </div>
                {!aiSummary.text && !aiSummary.loading && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2"
                    onClick={fetchAiSummary}
                  >
                    Generate Summary
                  </Button>
                )}
              </div>
              {aiSummary.loading ? (
                <div className="flex items-center gap-2 text-xs text-purple-600">
                  <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  Analyzing your credit report...
                </div>
              ) : aiSummary.error ? (
                <p className="text-xs text-red-600">{aiSummary.error}</p>
              ) : aiSummary.text ? (
                <p className="text-xs text-purple-800">{aiSummary.text}</p>
              ) : (
                <p className="text-xs text-stone-600">
                  Below are all dispute items sorted by severity. Address <strong>high severity</strong> items first as they have the biggest impact on your credit score.
                </p>
              )}
            </div>
            
            {/* High Severity Items */}
            {severityCounts.high > 0 && (
              <div className="space-y-2">
                <div className={cn("text-xs font-semibold flex items-center gap-2", SEVERITY_COLORS.high.text)}>
                  <div className={cn("w-2 h-2 rounded-full", SEVERITY_COLORS.high.badge)} />
                  High Priority ({severityCounts.high}) - Address First
                </div>
                <div className="pl-4 space-y-1">
                  {normalizedItems.filter(i => i.severity === 'high').slice(0, 5).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setActiveDisputeId(item.id); setShowSummary(false); }}
                      className="w-full text-left text-xs text-stone-700 hover:text-purple-700 hover:underline truncate"
                    >
                      • {item.creditorName || CATEGORY_LABELS[item.category]}: {normalizeFieldName(item.fieldPath)}
                    </button>
                  ))}
                  {severityCounts.high > 5 && <div className="text-[10px] text-stone-500 pl-2">+{severityCounts.high - 5} more...</div>}
                </div>
                <p className="text-[10px] text-stone-500 pl-4">
                  💡 These items (collections, charge-offs, 90+ days late) significantly damage your score. Dispute inaccuracies immediately.
                </p>
              </div>
            )}

            {/* Medium Severity Items */}
            {severityCounts.medium > 0 && (
              <div className="space-y-2">
                <div className={cn("text-xs font-semibold flex items-center gap-2", SEVERITY_COLORS.medium.text)}>
                  <div className={cn("w-2 h-2 rounded-full", SEVERITY_COLORS.medium.badge)} />
                  Medium Priority ({severityCounts.medium}) - Address Second
                </div>
                <div className="pl-4 space-y-1">
                  {normalizedItems.filter(i => i.severity === 'medium').slice(0, 5).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setActiveDisputeId(item.id); setShowSummary(false); }}
                      className="w-full text-left text-xs text-stone-700 hover:text-purple-700 hover:underline truncate"
                    >
                      • {item.creditorName || CATEGORY_LABELS[item.category]}: {normalizeFieldName(item.fieldPath)}
                    </button>
                  ))}
                  {severityCounts.medium > 5 && <div className="text-[10px] text-stone-500 pl-2">+{severityCounts.medium - 5} more...</div>}
                </div>
                <p className="text-[10px] text-stone-500 pl-4">
                  💡 These items (60 days late, derogatory marks) moderately affect your score. Dispute after addressing high priority items.
                </p>
              </div>
            )}

            {/* Low Severity Items */}
            {severityCounts.low > 0 && (
              <div className="space-y-2">
                <div className={cn("text-xs font-semibold flex items-center gap-2", SEVERITY_COLORS.low.text)}>
                  <div className={cn("w-2 h-2 rounded-full", SEVERITY_COLORS.low.badge)} />
                  Low Priority ({severityCounts.low}) - Address Last
                </div>
                <div className="pl-4 space-y-1">
                  {normalizedItems.filter(i => i.severity === 'low').slice(0, 5).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setActiveDisputeId(item.id); setShowSummary(false); }}
                      className="w-full text-left text-xs text-stone-700 hover:text-purple-700 hover:underline truncate"
                    >
                      • {item.creditorName || CATEGORY_LABELS[item.category]}: {normalizeFieldName(item.fieldPath)}
                    </button>
                  ))}
                  {severityCounts.low > 5 && <div className="text-[10px] text-stone-500 pl-2">+{severityCounts.low - 5} more...</div>}
                </div>
                <p className="text-[10px] text-stone-500 pl-4">
                  💡 These items (30 days late, minor errors) have minimal impact but are still worth correcting for accuracy.
                </p>
              </div>
            )}
          </div>}
        </div>
      )}

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
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openItemModal(item); }}
                        className="mt-2 flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-800 hover:underline"
                      >
                        <Eye className="w-3 h-3" />
                        View Details & AI Analysis
                      </button>
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
                      <div className="text-xs text-stone-600 mt-1"><span className="font-medium">Field</span>: {normalizeFieldName(activeItem.fieldPath)}</div>
                      <div className="text-xs text-stone-500 mt-0.5 wrap-break-word"><span className="font-medium">Value</span>: {formatDisplayValue(activeItem.value)}</div>
                      {showSource && (
                        <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 flex items-center gap-2 flex-wrap">
                          <ShieldAlert className="w-4 h-4 text-stone-600" /><span className="font-semibold">Source</span>
                          {activeItem.creditorName && <span>{activeItem.creditorName}</span>}
                          {activeItem.accountIdentifier && <span className="text-stone-500">({activeItem.accountIdentifier})</span>}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={roundsGated}
                      title={roundsGated ? "Upload a newer report to unlock next round" : undefined}
                      onClick={() => addNextRound(activeItem.id)}
                    >
                      <Plus className="w-4 h-4 mr-1" />Next round
                    </Button>
                    {roundsGated && (
                      <div className="text-[10px] text-stone-500 italic">Upload newer report to unlock</div>
                    )}
                    {!roundsGated && newerUploadInfo && (
                      <div className="text-[10px] text-green-600">Newer report available: {newerUploadInfo.filename}</div>
                    )}
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
                              <input type="date" className="h-8 w-[140px] rounded border border-stone-300 bg-white px-2 text-xs text-stone-700" value={current.date} onChange={(e) => updateCurrentRound(activeItem.id, { date: e.target.value })} />
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
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <label className="text-xs font-semibold text-stone-700">AI-Suggested Reasons</label>
                      {aiReasonById[activeItem.id]?.loading ? (
                        <span className="text-[11px] text-purple-600 animate-pulse">
                          {aiReasonById[activeItem.id]?.thinkingHarder ? '🧠 Thinking harder…' : '✨ Analyzing…'}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] gap-1"
                          onClick={() => suggestReason(activeItem, true)}
                          disabled={aiReasonById[activeItem.id]?.loading}
                        >
                          🧠 Think harder
                        </Button>
                      )}
                    </div>

                    {/* AI Suggested Reasons List */}
                    {aiReasonById[activeItem.id]?.reasons?.length ? (
                      <div className="space-y-1.5 mb-3">
                        {aiReasonById[activeItem.id].reasons.map((r, idx) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => { 
                              setDisputeReasons(prev => ({ ...prev, [activeItem.id]: r.label })); 
                              updateCurrentRound(activeItem.id, { selectedReason: r.label }); 
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded border text-xs transition-all",
                              selectedReason === r.label 
                                ? "bg-purple-100 border-purple-300 text-purple-800 ring-1 ring-purple-400" 
                                : "bg-white border-stone-200 text-stone-700 hover:border-purple-200 hover:bg-purple-50/50"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{idx === 0 ? '✓ ' : ''}{r.label}</span>
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded",
                                r.confidence >= 80 ? "bg-green-100 text-green-700" :
                                r.confidence >= 50 ? "bg-amber-100 text-amber-700" :
                                "bg-stone-100 text-stone-600"
                              )}>
                                {r.confidence}% match
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : !aiReasonById[activeItem.id]?.loading ? (
                      <div className="text-[11px] text-stone-500 mb-3">No AI suggestions yet.</div>
                    ) : null}

                    {/* AI Explanation */}
                    {aiReasonById[activeItem.id]?.summary ? (
                      <div className="rounded-md bg-purple-50 border border-purple-200 px-3 py-2 mb-3">
                        <div className="text-[10px] font-medium text-purple-700 mb-1">Why these reasons?</div>
                        <div className="text-[11px] text-purple-800">{aiReasonById[activeItem.id]?.summary}</div>
                      </div>
                    ) : null}

                    {aiReasonById[activeItem.id]?.error ? (
                      <div className="text-[11px] text-red-600 mb-2">{aiReasonById[activeItem.id]?.error}</div>
                    ) : null}

                    {/* Manual Override Dropdown */}
                    <div className="border-t border-stone-200 pt-3 mt-2">
                      <div className="text-[10px] text-stone-500 mb-1.5">Or select manually:</div>
                      <select 
                        className="w-full h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700" 
                        value={selectedReason} 
                        onChange={(e) => { 
                          setDisputeReasons(prev => ({ ...prev, [activeItem.id]: e.target.value })); 
                          updateCurrentRound(activeItem.id, { selectedReason: e.target.value }); 
                        }}
                      >
                        <option value="">Select a reason...</option>
                        <optgroup label="Credit Reporting Agency (CRA)">{DISPUTE_REASONS.cra.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}</optgroup>
                        <optgroup label="Creditor/Furnisher">{DISPUTE_REASONS.creditor.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}</optgroup>
                        <optgroup label="Collection Agency">{DISPUTE_REASONS.collection.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}</optgroup>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Dispute Account Modal */}
      <DisputeAccountModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        disputeItem={modalItem}
        aiAnalysis={modalItem ? {
          reasons: aiReasonById[modalItem.id]?.reasons || [],
          summary: aiReasonById[modalItem.id]?.summary || '',
          laymanExplanation: aiReasonById[modalItem.id]?.laymanExplanation || generateLaymanExplanation(modalItem),
          severity: modalItem.severity,
          impactDescription: '',
          loading: aiReasonById[modalItem.id]?.loading || false,
          error: aiReasonById[modalItem.id]?.error,
        } : undefined}
        onSendToLetter={handleModalSendToLetter}
        onAnalyze={(item) => suggestReason(item, false)}
        existingReasons={modalItem ? getExistingReasonsForItem(modalItem) : []}
      />
    </div>
  )
}
