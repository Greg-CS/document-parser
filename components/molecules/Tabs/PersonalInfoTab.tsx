"use client";

import React from "react";
import { ImportedFile } from "@/lib/interfaces/GlobalInterfaces";
import { Badge } from "@/components/atoms/badge";
import { TransUnionLogo, ExperianLogo, EquifaxLogo } from "@/components/molecules/icons/CreditBureauIcons";
import { getValueAtPath, normalizeFieldName, normalizeTextDisplay, cn } from "@/lib/utils";
import { User, MapPin, Briefcase, Phone, Mail, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";

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

const categoryIcons = {
  identity: User,
  address: MapPin,
  employment: Briefcase,
  contact: Phone,
  other: User,
};

const categoryLabels = {
  identity: "Identity Information",
  address: "Address History",
  employment: "Employment",
  contact: "Contact Information",
  other: "Other Information",
};

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Personal Information</h2>
          <p className="text-sm text-slate-500 mt-0.5">Your identity and contact details from credit bureaus</p>
        </div>
        <div className="flex items-center gap-2">
          {mismatchCount > 0 && (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {mismatchCount} mismatch{mismatchCount !== 1 ? "es" : ""}
            </Badge>
          )}
          {mismatchCount === 0 && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              All data matches
            </Badge>
          )}
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["identity", "address", "employment", "contact", "other"] as const).map(category => {
          const items = groupedData[category];
          if (items.length === 0) return null;

          const Icon = categoryIcons[category];
          const categoryMismatches = items.filter(i => i.hasMismatch).length;

          return (
            <div 
              key={category} 
              className={cn(
                "rounded-xl border bg-white p-4 shadow-sm",
                categoryMismatches > 0 ? "border-amber-200" : "border-slate-200"
              )}
            >
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  categoryMismatches > 0 ? "bg-amber-100" : "bg-slate-100"
                )}>
                  <Icon className={cn(
                    "w-4 h-4",
                    categoryMismatches > 0 ? "text-amber-600" : "text-slate-600"
                  )} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-800">{categoryLabels[category]}</div>
                  <div className="text-xs text-slate-500">{items.length} field{items.length !== 1 ? "s" : ""}</div>
                </div>
                {categoryMismatches > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    {categoryMismatches} mismatch
                  </Badge>
                )}
              </div>

              {/* Fields */}
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-600">{item.label}</span>
                      {item.hasMismatch && (
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      )}
                    </div>
                    
                    {item.hasMismatch ? (
                      <div className="space-y-1">
                        {item.values.map((v, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center gap-2 text-sm bg-slate-50 rounded px-2 py-1"
                          >
                            <div className="shrink-0">{v.logo}</div>
                            <span className="text-slate-700 truncate">{v.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-900">{item.values[0]?.value || "—"}</span>
                        <div className="flex items-center gap-1">
                          {item.values.map((v, idx) => (
                            <div key={idx} className="opacity-60 scale-75">{v.logo}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
