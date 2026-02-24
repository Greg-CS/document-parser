"use client";

import React from "react";
import { ImportedFile } from "@/lib/interfaces/GlobalInterfaces";
import { TransUnionLogo, ExperianLogo, EquifaxLogo } from "@/components/molecules/icons/CreditBureauIcons";
import { getValueAtPath, normalizeFieldName, normalizeTextDisplay, cn } from "@/lib/utils";
import { User, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";

const PERSONAL_INFO_PATTERNS = [
  "firstname", "lastname", "middlename", "name", "birthdate", "dob", "ssn",
  "address", "street", "city", "state", "zip", "postal", "phone", "email",
  "employer", "employment", "income", "borrower"
];

function isPersonalInfoKey(key: string): boolean {
  const lower = key.toLowerCase();
  return PERSONAL_INFO_PATTERNS.some(p => lower.includes(p));
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function getFieldCategory(key: string): "identity" | "address" | "employment" | "contact" | "other" {
  const lower = key.toLowerCase();
  if (lower.includes("name") || lower.includes("birth") || lower.includes("dob") || lower.includes("ssn")) return "identity";
  if (lower.includes("address") || lower.includes("street") || lower.includes("city") || lower.includes("state") || lower.includes("zip") || lower.includes("postal")) return "address";
  if (lower.includes("employer") || lower.includes("employment") || lower.includes("income") || lower.includes("occupation")) return "employment";
  if (lower.includes("phone") || lower.includes("email") || lower.includes("contact")) return "contact";
  return "other";
}

interface PersonalInfoTabProp {
  tuFile?: ImportedFile;
  exFile?: ImportedFile;
  eqFile?: ImportedFile;
  showFullKeys: boolean;
}

export function PersonalInfoTab({ tuFile, exFile, eqFile, showFullKeys }: PersonalInfoTabProp) {
  const personalKeys = React.useMemo(() => {
    const keyMap = new Map<string, string>();
    
    const addKeys = (file?: ImportedFile) => {
      if (!file) return;
      file.keys.filter(isPersonalInfoKey).forEach((fullKey: string) => {
        const normalized = normalizeFieldName(fullKey);
        if (!keyMap.has(normalized)) {
          keyMap.set(normalized, fullKey);
        }
      });
    };
    
    addKeys(tuFile);
    addKeys(exFile);
    addKeys(eqFile);
    
    return Array.from(keyMap.values()).sort((a, b) => 
      normalizeFieldName(a).localeCompare(normalizeFieldName(b))
    );
  }, [tuFile, exFile, eqFile]);

  const groupedData = React.useMemo(() => {
    const groups: Record<string, Array<{
      key: string;
      label: string;
      values: { bureau: string; value: string; logo: React.ReactNode }[];
      hasMismatch: boolean;
    }>> = {
      identity: [],
      address: [],
      employment: [],
      contact: [],
      other: [],
    };

    for (const key of personalKeys) {
      const category = getFieldCategory(key);
      const label = showFullKeys ? key : normalizeFieldName(key);
      
      const tuVal = tuFile ? getValueAtPath(tuFile.data, key) : undefined;
      const exVal = exFile ? getValueAtPath(exFile.data, key) : undefined;
      const eqVal = eqFile ? getValueAtPath(eqFile.data, key) : undefined;

      const values: { bureau: string; value: string; logo: React.ReactNode }[] = [];
      
      if (tuVal !== undefined && tuVal !== null) {
        values.push({ bureau: "TransUnion", value: normalizeTextDisplay(stringifyValue(tuVal)), logo: <TransUnionLogo /> });
      }
      if (exVal !== undefined && exVal !== null) {
        values.push({ bureau: "Experian", value: normalizeTextDisplay(stringifyValue(exVal)), logo: <ExperianLogo /> });
      }
      if (eqVal !== undefined && eqVal !== null) {
        values.push({ bureau: "Equifax", value: normalizeTextDisplay(stringifyValue(eqVal)), logo: <EquifaxLogo /> });
      }

      if (values.length === 0) continue;

      const uniqueValues = new Set(values.map(v => v.value));
      const hasMismatch = uniqueValues.size > 1;

      groups[category].push({ key, label, values, hasMismatch });
    }

    return groups;
  }, [personalKeys, tuFile, exFile, eqFile, showFullKeys]);

  const mismatchCount = Object.values(groupedData).flat().filter(item => item.hasMismatch).length;
  const hasData = Object.values(groupedData).some(group => group.length > 0);

  if (!hasData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <div className="text-slate-500 text-sm font-medium">No Personal Information Found</div>
        <div className="text-slate-400 text-xs mt-1">Upload a credit report to see personal details</div>
      </div>
    );
  }

  const allItems = Object.values(groupedData).flat();

  const row = (label: string, tuValue: string, exValue: string, eqValue: string) => {
    const values = [tuValue, exValue, eqValue].filter((v) => v !== "—");
    const hasDiscrepancy = values.length > 1 && !values.every((v) => v === values[0]);

    const renderCell = (val: string, idx: number) => {
      return (
        <td
          key={idx}
          className={cn(
            "py-2 px-3 text-center text-xs text-stone-700",
            hasDiscrepancy && val !== "—" && "bg-amber-200/20 font-medium",
            idx < 2 && "border-r border-amber-200/80"
          )}
        >
          {val}
        </td>
      );
    };

    return (
      <tr className={cn("hover:bg-amber-50/40", hasDiscrepancy && "bg-amber-100/30")}>
        <td className="py-2 px-3 text-left text-xs font-medium text-stone-600 w-[200px] border-r border-amber-200/80">
          <div className="flex items-center gap-1">
            {label}
            {hasDiscrepancy && <AlertTriangle className="w-3 h-3 text-amber-600" />}
          </div>
        </td>
        {renderCell(tuValue, 0)}
        {renderCell(exValue, 1)}
        {renderCell(eqValue, 2)}
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Personal Information</h2>
        <p className="text-sm text-slate-500 mt-1">
          {mismatchCount > 0
            ? `${mismatchCount} field${mismatchCount !== 1 ? 's' : ''} show discrepancies across bureaus.`
            : 'All personal information matches across bureaus.'}
        </p>
      </div>

      {/* Summary Cards */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border p-5 bg-white border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-slate-600">Total Fields</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">{allItems.length}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Personal data points tracked</p>
        </div>

        {mismatchCount > 0 ? (
          <div className="rounded-xl border-2 p-5 bg-amber-50 border-amber-400">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-amber-700">Mismatches</div>
                <div className="text-3xl font-bold text-amber-600 mt-1">{mismatchCount}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Require verification</p>
          </div>
        ) : (
          <div className="rounded-xl border p-5 bg-green-50 border-green-300">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-green-700">All Match</div>
                <div className="text-3xl font-bold text-green-600 mt-1">✓</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Consistent across bureaus</p>
          </div>
        )}

        <div className="rounded-xl border p-5 bg-white border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-slate-600">Bureaus</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">
                {[tuFile, exFile, eqFile].filter(Boolean).length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-slate-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Reporting sources</p>
        </div>
      </div> */}

      {/* Table View */}
      <div className="rounded-lg border border-amber-200/80 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
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
              {allItems.map(item => {
                const tuVal = item.values.find(v => v.bureau === "TransUnion")?.value || "—";
                const exVal = item.values.find(v => v.bureau === "Experian")?.value || "—";
                const eqVal = item.values.find(v => v.bureau === "Equifax")?.value || "—";
                return row(item.label, tuVal, exVal, eqVal);
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
