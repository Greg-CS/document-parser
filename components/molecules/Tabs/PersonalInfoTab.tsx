import React from "react";
import { ImportedFile } from "@/lib/interfaces/GlobalInterfaces";
import { Badge } from "@/components/atoms/badge";
import { TransUnionLogo, ExperianLogo, EquifaxLogo } from "@/components/molecules/icons/CreditBureauIcons";
import { getValueAtPath, shortKey, normalizeFieldName, normalizeTextDisplay, cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/atoms/popover";
import { AlertTriangle, ChevronDown, Check } from "lucide-react";

// Personal info field patterns
const PERSONAL_INFO_PATTERNS = [
  "firstname", "lastname", "middlename", "name", "birthdate", "dob", "ssn",
  "address", "street", "city", "state", "zip", "postal", "phone", "email",
  "employer", "employment", "income", "borrower"
];

function isPersonalInfoKey(key: string): boolean {
  const lower = key.toLowerCase();
  return PERSONAL_INFO_PATTERNS.some(p => lower.includes(p));
}

type BureauIndex = 0 | 1 | 2;
const BUREAU_NAMES: Record<BureauIndex, string> = { 0: "TransUnion", 1: "Experian", 2: "Equifax" };

function stringifyPrimitive(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

interface PersonalInfoTabProp {
  tuFile?: ImportedFile;
  exFile?: ImportedFile;
  eqFile?: ImportedFile;
  showFullKeys: boolean;
}

// Personal Info Tab Component
export function PersonalInfoTab({ tuFile, exFile, eqFile, showFullKeys }: PersonalInfoTabProp) {
  const [selectedCorrect, setSelectedCorrect] = React.useState<Record<string, BureauIndex>>({});

  const personalKeys = React.useMemo(() => {
    const keyMap = new Map<string, string>();
    
    const addKeys = (file?: ImportedFile) => {
      if (!file) return;
      file.keys.filter(isPersonalInfoKey).forEach((fullKey: string) => {
        const sk = shortKey(fullKey);
        if (!keyMap.has(sk)) {
          keyMap.set(sk, fullKey);
        }
      });
    };
    
    addKeys(tuFile);
    addKeys(exFile);
    addKeys(eqFile);
    
    return Array.from(keyMap.values()).sort((a, b) => shortKey(a).localeCompare(shortKey(b)));
  }, [tuFile, exFile, eqFile]);

  const rowsData = React.useMemo(() => {
    return personalKeys.map((key) => {
      const values = [
        tuFile ? getValueAtPath(tuFile.data, key) : undefined,
        exFile ? getValueAtPath(exFile.data, key) : undefined,
        eqFile ? getValueAtPath(eqFile.data, key) : undefined,
      ] as [unknown, unknown, unknown];
      
      const defined = values.filter((v) => v !== undefined && v !== null);
      const normalized = defined.map((v) => JSON.stringify(v));
      const mismatch = new Set(normalized).size > 1;
      
      return { key, values, mismatch };
    });
  }, [personalKeys, tuFile, exFile, eqFile]);

  const handleSelectCorrect = (key: string, idx: BureauIndex) => {
    setSelectedCorrect((prev) => ({ ...prev, [key]: idx }));
  };

  const renderCellValue = (val: unknown) => {
    if (val === undefined || val === null) return <span className="text-stone-400">—</span>;
    if (typeof val === "object") {
      return <span className="text-stone-500 text-xs">{Array.isArray(val) ? `[${val.length} items]` : "{...}"}</span>;
    }
    return <span className="wrap-break-word">{normalizeTextDisplay(stringifyPrimitive(val))}</span>;
  };

  if (personalKeys.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200/80 bg-amber-50 p-6 text-center">
        <p className="text-stone-600 text-sm">No personal information fields found in the report</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-stone-800">Personal Information</h2>
        <Badge variant="outline" className="text-xs">{personalKeys.length} fields</Badge>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
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
            {rowsData.map(({ key, values, mismatch }) => {
              const displayLabel = showFullKeys ? key : normalizeFieldName(key);
              const selected = selectedCorrect[key];
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
                      <span className="wrap-break-word whitespace-normal">{displayLabel}</span>
                    )}
                  </td>
                  {([0, 1, 2] as BureauIndex[]).map((idx) => {
                    const val = values[idx];
                    const isCorrect = selected === idx;
                    
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
                        {renderCellValue(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}