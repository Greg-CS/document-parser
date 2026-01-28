import React from "react";
import { TransUnionLogo, ExperianLogo, EquifaxLogo } from "@/components/molecules/icons/CreditBureauIcons";
import { getValueAtPath, shortKey, stringifyPrimitive, normalizeTextDisplay, normalizeFieldName, cn } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import { AlertTriangle, Check, Send, ChevronDown, Eye } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/atoms/popover";
import type { ImportedFile } from "@/lib/interfaces/GlobalInterfaces";
import { FIELD_DEFINITIONS } from "@/lib/types/Global";

type BureauIndex = 0 | 1 | 2;
const BUREAU_NAMES: Record<BureauIndex, string> = { 0: "TransUnion", 1: "Experian", 2: "Equifax" };

// Helper to render cell values - with optional expand button for objects
function renderCellValue(value: unknown, onExpand?: () => void): React.ReactNode {
  if (value === undefined || value === null) return <span className="text-stone-400">—</span>;
  if (typeof value === "object") {
    const summary = Array.isArray(value) ? `[${value.length} items]` : "{...}";
    return (
      <div className="flex items-center justify-center gap-1">
        <span className="text-stone-500 text-xs">{summary}</span>
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-600 hover:bg-stone-300 flex items-center gap-0.5"
          >
            <Eye className="w-3 h-3" />
            View
          </button>
        )}
      </div>
    );
  }
  const display = normalizeTextDisplay(stringifyPrimitive(value));
  return <span className="wrap-break-word whitespace-normal">{display}</span>;
}

// Check if values differ across bureaus
function hasMismatch(values: [unknown, unknown, unknown]): boolean {
  const present = values.filter((v) => v !== undefined && v !== null);
  if (present.length < 2) return false;
  const first = stringifyPrimitive(present[0]);
  return !present.every((v) => stringifyPrimitive(v) === first);
}

// Dev-only field patterns - these are internal identifiers not useful to clients
const DEV_ONLY_PATTERNS = [
  /@BorrowerID$/i,
  /@CreditFileID$/i,
  /@CreditLiabilityID$/i,
  /@CreditInquiryID$/i,
  /@CreditScoreID$/i,
  /@CreditResponseID$/i,
  /@CreditPublicRecordID$/i,
  /@CreditTradeReferenceID$/i,
  /@CreditReportIdentifier$/i,
  /HashComplex$/i,
  /HashSimple$/i,
  /@TUI_Handle$/i,
  /@MISMOVersionID$/i,
  /@CreditRatingCodeType$/i,
  /@CreditReportMergeTypeIndicator$/i,
  /@_SubscriberCode$/i,
  /@_SourceType$/i,
  /@ArrayAccountIdentifier$/i,
  /@RawIndustryCode$/i,
  /@RawIndustryText$/i,
  /@RawAccountStatus$/i,
  /@RawAccountType$/i,
  /@CreditBusinessType$/i,
  /@CreditLoanTypeCode$/i,
  /@CreditRepositorySourceType$/i,
  /@_FACTAInquiriesIndicator$/i,
  /@_ModelNameTypeOtherDescription$/i,
  /@RiskBasedPricing/i,
  /CREDIT_BUREAU$/i,
  /REQUESTING_PARTY$/i,
  /_DATA_INFORMATION\./i,
  /DATA_VERSION\[\*\]/i,
  /CREDIT_REPOSITORY_INCLUDED/i,
  /CREDIT_REQUEST_DATA/i,
  /@_UnparsedName$/i,
  /@_ResultStatusType$/i,
  /@_CategoryType$/i,
  /@_TypeOtherDescription$/i,
  /@_TypeOtherDescripton$/i,
  /CREDIT_COMMENT\[\*\]\.@_Code$/i,
  /CREDIT_COMMENT\.@_Code$/i,
  /CREDIT_COMMENT\[\*\]\.@_Type$/i,
  /CREDIT_COMMENT\.@_Type$/i,
  /CREDIT_COMMENT\[\*\]\.@_SourceType$/i,
  /CREDIT_COMMENT\.@_SourceType$/i,
  /_ALERT_MESSAGE\[\*\]\./i,
  /_VARIATION\.@_Type$/i,
  /@EmploymentCurrentIndicator$/i,
  /@DateClosedIndicator$/i,
  /@IsChargeoffIndicator$/i,
  /@IsClosedIndicator$/i,
  /@IsCollectionIndicator$/i,
  /@IsMortgageIndicator$/i,
  /@SecuredLoanIndicator$/i,
  /@_FirstDelinquencyDateSourceType$/i,
  /_CURRENT_RATING\.@_Code$/i,
  /_CURRENT_RATING\.@_Type$/i,
  /_HIGHEST_negative_RATING\./i,
  /_MOST_RECENT_negative_RATING\./i,
  /_PAYMENT_PATTERN\.@_Data$/i,
  /_PAYMENT_PATTERN\.@_StartDate$/i,
  /CREDIT_REPOSITORY\[\*\]\./i,
  /CREDIT_REPOSITORY\.@/i,
  /_FACTOR\[\*\]\./i,
  /_POSITIVE_FACTOR\[\*\]\./i,
  /_DATA_SET\[\*\]\.@_ID$/i,
  /CONTACT_DETAIL\.CONTACT_POINT/i,
  /CREDIT_FROZEN_STATUS/i,
];

function isDevOnlyKey(key: string): boolean {
  return DEV_ONLY_PATTERNS.some((pattern) => pattern.test(key));
}

interface OverviewTabProps {
  tuFile?: ImportedFile;
  exFile?: ImportedFile;
  eqFile?: ImportedFile;
  allKeys: string[];
  showFullKeys: boolean;
  setShowFullKeys: React.Dispatch<React.SetStateAction<boolean>>;
  developerFieldsEnabled?: boolean;
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void;
}

export const Overviewtab = ({ tuFile, exFile, eqFile, allKeys, showFullKeys, setShowFullKeys, developerFieldsEnabled = false, onSendToLetter }: OverviewTabProps) => {
  // Filter keys: show all when dev mode, otherwise exclude dev-only paths
  const displayKeys = React.useMemo(() => {
    if (developerFieldsEnabled) return allKeys;
    return allKeys.filter((key) => !isDevOnlyKey(key));
  }, [allKeys, developerFieldsEnabled]);

  // Track selected correct values for mismatched fields: key -> bureau index
  const [selectedCorrect, setSelectedCorrect] = React.useState<Record<string, BureauIndex>>({});
  
  // Track expanded object values for viewing
  const [expandedValues, setExpandedValues] = React.useState<Record<string, { bureau: BureauIndex; value: unknown } | null>>({});
  
  // Build rows with values and mismatch info
  const rowsData = React.useMemo(() => {
    return displayKeys.map((key) => {
      const values: [unknown, unknown, unknown] = [
        tuFile ? getValueAtPath(tuFile.data, key) : undefined,
        exFile ? getValueAtPath(exFile.data, key) : undefined,
        eqFile ? getValueAtPath(eqFile.data, key) : undefined,
      ];
      const mismatch = hasMismatch(values);
      return { key, values, mismatch };
    });
  }, [displayKeys, tuFile, exFile, eqFile]);
  
  // Count mismatches
  const mismatchCount = rowsData.filter((r) => r.mismatch).length;
  const selectedMismatches = Object.keys(selectedCorrect).filter((k) => rowsData.find((r) => r.key === k)?.mismatch);

  const handleSelectCorrect = (key: string, bureauIdx: BureauIndex) => {
    setSelectedCorrect((prev) => ({ ...prev, [key]: bureauIdx }));
  };

  const handleSendMismatchesToLetter = () => {
    if (!onSendToLetter) return;
    const items = selectedMismatches.map((key) => {
      const row = rowsData.find((r) => r.key === key);
      const correctIdx = selectedCorrect[key];
      const correctValue = row?.values[correctIdx];
      const bureauName = BUREAU_NAMES[correctIdx];
      return {
        label: `Data mismatch: ${shortKey(key)}`,
        value: `Correct value (from ${bureauName}): ${stringifyPrimitive(correctValue)}. Other bureaus report different information.`,
      };
    });
    onSendToLetter(items);
  };

  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-stone-800">Credit Report Overview</h2>
          {mismatchCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {mismatchCount} mismatch{mismatchCount !== 1 ? "es" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
            {selectedMismatches.length > 0 && onSendToLetter && (
              <Button
                variant="default"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={handleSendMismatchesToLetter}
              >
                <Send className="w-3 h-3" />
                Report {selectedMismatches.length} mismatch{selectedMismatches.length !== 1 ? "es" : ""}
              </Button>
            )}
            {developerFieldsEnabled && (
              <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-stone-500 hover:text-stone-700"
              onClick={() => setShowFullKeys(!showFullKeys)}
              >
              {showFullKeys ? "Short keys" : "Full keys"}
              </Button>
            )}
        </div>
        </div>

        {displayKeys.length === 0 ? (
          <div className="p-6 text-center text-stone-500 text-sm">
            No fields found in imported files.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full table-fixed">
              <thead className="sticky top-0 z-10">
              <tr className="border-b border-amber-200/80 bg-amber-100">
                  <th className="py-3 px-3 text-left text-sm font-medium text-stone-600 w-[28%] min-w-[140px] border-r border-amber-200/80">
                  Field
                  </th>
                  <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[24%] min-w-[100px]">
                  <TransUnionLogo />
                  </th>
                  <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[24%] min-w-[100px]">
                  <ExperianLogo />
                  </th>
                  <th className="py-3 px-3 text-center w-[24%] min-w-[100px]">
                  <EquifaxLogo />
                  </th>
              </tr>
              </thead>
              <tbody className="divide-y divide-amber-200/60">
              {rowsData.map(({ key, values, mismatch }) => {
                const displayLabel = showFullKeys ? key : normalizeFieldName(key);
                const selected = selectedCorrect[key];
                const fieldDescription = FIELD_DEFINITIONS[shortKey(key).toLowerCase()] || FIELD_DEFINITIONS[normalizeFieldName(key).toLowerCase()];
                const presentBureaus = ([0, 1, 2] as BureauIndex[]).filter(
                  (idx) => values[idx] !== undefined && values[idx] !== null
                );
                
                return (
                  <tr 
                    key={key} 
                    className={cn(
                      "hover:bg-amber-100/40 transition-colors",
                      mismatch && "bg-amber-100/50"
                    )}
                  >
                    <td className="py-2 px-3 text-sm font-medium text-stone-700 border-r border-amber-200/80 align-top">
                      {mismatch && presentBureaus.length > 1 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center gap-1.5 text-left hover:text-purple-700 transition-colors group"
                            >
                              <span className="wrap-break-word whitespace-normal">{displayLabel}</span>
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-purple-600 shrink-0" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-stone-700">Select correct value:</div>
                              <div className="space-y-1.5">
                                {presentBureaus.map((idx) => {
                                  const val = values[idx];
                                  const isCorrect = selected === idx;
                                  const displayVal = typeof val === "object" 
                                    ? (Array.isArray(val) ? `[${val.length} items]` : "{...}") 
                                    : normalizeTextDisplay(stringifyPrimitive(val));
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleSelectCorrect(key, idx)}
                                      className={cn(
                                        "w-full text-left px-2 py-1.5 rounded border text-xs transition-all",
                                        isCorrect 
                                          ? "bg-green-100 border-green-400 text-green-800 ring-1 ring-green-400" 
                                          : "bg-white border-stone-200 text-stone-700 hover:border-purple-300 hover:bg-purple-50"
                                      )}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">{BUREAU_NAMES[idx]}</span>
                                        {isCorrect && <Check className="w-3 h-3 text-green-600" />}
                                      </div>
                                      <div className="text-[11px] text-stone-600 mt-0.5 wrap-break-word">{displayVal}</div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="flex items-center gap-1" title={fieldDescription || key}>
                          <span className="wrap-break-word whitespace-normal">{displayLabel}</span>
                          {mismatch && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />}
                        </div>
                      )}
                      {fieldDescription && (
                        <div className="text-[10px] text-stone-500 mt-0.5">{fieldDescription}</div>
                      )}
                    </td>
                    {([0, 1, 2] as BureauIndex[]).map((idx) => {
                      const val = values[idx];
                      const isCorrect = selected === idx;
                      const isObject = typeof val === "object" && val !== null;
                      const expanded = expandedValues[key];
                      const isExpanded = expanded?.bureau === idx;
                      
                      return (
                        <td 
                          key={idx} 
                          className={cn(
                            "py-2 px-3 text-sm text-center text-stone-600 align-top",
                            idx < 2 && "border-r border-amber-200/80",
                            mismatch && val !== undefined && val !== null && "bg-amber-200/30",
                            isCorrect && "bg-green-100 ring-2 ring-inset ring-green-400"
                          )}
                        >
                          <div className="flex flex-col items-center gap-1">
                            {renderCellValue(val, isObject ? () => {
                              setExpandedValues((prev) => ({
                                ...prev,
                                [key]: isExpanded ? null : { bureau: idx, value: val }
                              }));
                            } : undefined)}
                            {isExpanded && (
                              <div className="mt-2 p-2 bg-stone-100 rounded text-[11px] text-left max-h-40 overflow-auto w-full">
                                <pre className="whitespace-pre-wrap wrap-break-word">
                                  {JSON.stringify(val, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              </tbody>
          </table>
          </div>
        )}
    </div>
  );
}
