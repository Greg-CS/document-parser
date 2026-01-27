import React from "react";
import { ImportedFile } from "@/lib/interfaces/GlobalInterfaces";
import { Badge } from "@/components/atoms/badge";
import { TransUnionLogo, ExperianLogo, EquifaxLogo } from "@/components/molecules/icons/CreditBureauIcons";
import { ReportRow } from "../TableAssets/ReportRow";
import { getValueAtPath, shortKey } from "@/lib/utils";

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

interface PersonalInfoTabProp {
  tuFile?: ImportedFile;
  exFile?: ImportedFile;
  eqFile?: ImportedFile;
  showFullKeys: boolean;
}

// Personal Info Tab Component
export function PersonalInfoTab({ tuFile, exFile, eqFile, showFullKeys }: PersonalInfoTabProp) {
  const personalKeys = React.useMemo(() => {
    const keyMap = new Map<string, string>(); // shortKey -> fullKey
    
    const addKeys = (file?: ImportedFile) => {
      if (!file) return;
      file.keys.filter(isPersonalInfoKey).forEach((fullKey: string) => {
        const sk = shortKey(fullKey);
        // Prefer the key that already exists or the new one, 
        // effectively deduplicating by the "meaning" of the key (shortKey)
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
            {personalKeys.map((key) => (
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
  );
}