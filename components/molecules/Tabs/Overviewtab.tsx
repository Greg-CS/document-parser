import React from "react";
import { TransUnionLogo, ExperianLogo, EquifaxLogo } from "@/components/molecules/icons/CreditBureauIcons";
import { ReportRow } from "../TableAssets/ReportRow";
import { getValueAtPath, shortKey } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import type { ImportedFile } from "@/lib/interfaces/GlobalInterfaces";

interface OverviewTabProps {
  tuFile?: ImportedFile;
  exFile?: ImportedFile;
  eqFile?: ImportedFile;
  allKeys: string[];
  showFullKeys: boolean;
  setShowFullKeys: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Overviewtab = ({ tuFile, exFile, eqFile, allKeys, showFullKeys, setShowFullKeys }: OverviewTabProps) => {
  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-100/50 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-stone-800">Credit Report Overview</h2>
        <div className="flex items-center gap-3">
            {/* <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
                const fieldsList = allKeys.join("\n");
                navigator.clipboard.writeText(fieldsList);
            }}
            >
            📋 Copy Fields
            </Button> */}
            <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 text-stone-500 hover:text-stone-700"
            onClick={() => setShowFullKeys(!showFullKeys)}
            >
            {showFullKeys ? "Short keys" : "Full keys"}
            </Button>
        </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
        <table className="w-full table-fixed">
            <thead>
            <tr className="border-b border-amber-200/80 bg-amber-100/50">
                <th className="py-3 px-3 text-left text-sm font-medium text-stone-600 w-[25%] min-w-[120px] border-r border-amber-200/80">
                Field
                </th>
                <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[25%] min-w-[100px]">
                <TransUnionLogo />
                </th>
                <th className="py-3 px-3 text-center border-r border-amber-200/80 w-[25%] min-w-[100px]">
                <ExperianLogo />
                </th>
                <th className="py-3 px-3 text-center w-[25%] min-w-[100px]">
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
  )
}
