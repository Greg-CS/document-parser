"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import {
  extractDisputeItems,
  type DisputeItem,
} from "@/lib/dispute-fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/atoms/tabs";
import { Badge } from "@/components/atoms/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/atoms/tooltip";
import type { ImportedFile, BureauAssignment } from "@/lib/interfaces/GlobalInterfaces";
import { AccountsTab } from "../../molecules/Tabs/AccountTab";
import { PersonalInfoTab } from "../../molecules/Tabs/PersonalInfoTab";
import { Overviewtab } from "@/components/molecules/Tabs/Overviewtab";
import { DisputesTab } from "@/components/molecules/Tabs/DisputesTab";
import { hasDerogatoryIndicator } from "@/lib/utils";
import { ProcessingAnimation } from "@/components/molecules/ProcessingAnimation";

// Business credit dispute reasons
export const DISPUTE_REASONS = {
  cra: [
    { id: "not_mine", label: "Account does not belong to my business" },
    { id: "paid_in_full", label: "Account was paid in full" },
    { id: "incorrect_balance", label: "Balance is incorrect" },
    { id: "incorrect_status", label: "Account status is incorrect" },
    { id: "duplicate", label: "Duplicate account" },
    { id: "outdated", label: "Information is outdated" },
    { id: "identity_theft", label: "Fraudulent account (identity theft)" },
  ],
  creditor: [
    { id: "never_late", label: "Never late on this account" },
    { id: "settled", label: "Account was settled" },
    { id: "bankruptcy_discharged", label: "Discharged in bankruptcy" },
    { id: "statute_of_limitations", label: "Beyond statute of limitations" },
    { id: "incorrect_creditor", label: "Wrong creditor listed" },
    { id: "paid_before_chargeoff", label: "Paid before charge-off" },
  ],
  collection: [
    { id: "no_validation", label: "Debt not validated" },
    { id: "paid_collection", label: "Collection was paid" },
    { id: "medical_debt", label: "Medical debt under $500" },
    { id: "wrong_amount", label: "Collection amount is wrong" },
  ],
} as const;

// Account type colors - exported for use in accounts tab
export const ACCOUNT_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  revolving: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  installment: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  mortgage: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  open: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700" },
  collection: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  unknown: { bg: "bg-stone-50", border: "border-stone-200", text: "text-stone-700" },
};

export function getAccountTypeColor(accountType: string) {
  const normalized = accountType.toLowerCase();
  if (normalized.includes("revolv")) return ACCOUNT_TYPE_COLORS.revolving;
  if (normalized.includes("install")) return ACCOUNT_TYPE_COLORS.installment;
  if (normalized.includes("mortgage") || normalized.includes("real estate")) return ACCOUNT_TYPE_COLORS.mortgage;
  if (normalized.includes("open")) return ACCOUNT_TYPE_COLORS.open;
  if (normalized.includes("collection")) return ACCOUNT_TYPE_COLORS.collection;
  return ACCOUNT_TYPE_COLORS.unknown;
}

interface InlineCreditReportViewProps {
  importedFiles: ImportedFile[];
  assignments: BureauAssignment;
  onSendToLetter?: (items: Array<{ label: string; value: string }>) => void;
  isLoading?: boolean;
}

export function InlineCreditReportView({
  importedFiles,
  assignments,
  isLoading = false,
  onSendToLetter,
}: InlineCreditReportViewProps) {
  const [showFullKeys, setShowFullKeys] = React.useState(false);
  const [developerFieldsEnabled, setDeveloperFieldsEnabled] = React.useState(false);
  const [isLocalhost, setIsLocalhost] = React.useState(false);

  React.useEffect(() => {
    const host = window.location.hostname;
    setIsLocalhost(host === "localhost" || host === "127.0.0.1");
  }, []);

  const tuFile = importedFiles.find((f) => f.id === assignments.transunion);
  const exFile = importedFiles.find((f) => f.id === assignments.experian);
  const eqFile = importedFiles.find((f) => f.id === assignments.equifax);

  const hasDerogatory = React.useMemo(() => {
    if (tuFile && hasDerogatoryIndicator(tuFile.data, tuFile.keys)) return true;
    if (exFile && hasDerogatoryIndicator(exFile.data, exFile.keys)) return true;
    if (eqFile && hasDerogatoryIndicator(eqFile.data, eqFile.keys)) return true;
    return false;
  }, [tuFile, exFile, eqFile]);

  const allKeys = React.useMemo(() => {
    const keySet = new Set<string>();
    if (tuFile) tuFile.keys.forEach((k: string) => keySet.add(k));
    if (exFile) exFile.keys.forEach((k: string) => keySet.add(k));
    if (eqFile) eqFile.keys.forEach((k: string) => keySet.add(k));
    return Array.from(keySet).sort();
  }, [tuFile, exFile, eqFile]);

  const hasData = tuFile || exFile || eqFile;

  const disputeItems = React.useMemo(() => {
    const items: DisputeItem[] = [];
    if (tuFile) items.push(...extractDisputeItems(tuFile.data, tuFile.keys, "transunion"));
    if (exFile) items.push(...extractDisputeItems(exFile.data, exFile.keys, "experian"));
    if (eqFile) items.push(...extractDisputeItems(eqFile.data, eqFile.keys, "equifax"));
    return items;
  }, [tuFile, exFile, eqFile]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-purple-200/50 bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50 overflow-hidden shadow-lg">
        <ProcessingAnimation
          stage="analyzing"
          progress={0}
          message="Loading credit report..."
          subMessage="Analyzing data from credit bureaus"
        />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="rounded-xl border-2 border-dashed border-purple-200 bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50 p-12 text-center animate-fade-in-up">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No Credit Report Loaded</h3>
            <p className="text-sm text-slate-500">Import a credit report file to view the analysis</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-purple-200/50 overflow-hidden shadow-lg animate-fade-in-up">
      {hasDerogatory && (
        <div className="absolute top-0 right-0 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-bl-lg shadow-lg">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Derogatory</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>This report contains derogatory data indicators</TooltipContent>
          </Tooltip>
        </div>
      )}

      <Tabs defaultValue="overview" className="flex flex-col">
        <div className="bg-linear-to-r from-purple-900 via-purple-800 to-purple-900 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <TabsList className="bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="overview" className="border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-none">
              Overview
            </TabsTrigger>
            <TabsTrigger value="personal" className="border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-none">
              Personal Info
            </TabsTrigger>
            <TabsTrigger value="accounts" className="border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-none">
              Accounts
            </TabsTrigger>
            <TabsTrigger value="disputes" className="border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent text-purple-200 data-[state=active]:text-white px-4 py-2.5 text-sm font-medium rounded-none">
              Disputes
              {disputeItems.length > 0 && (
                <Badge className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0">{disputeItems.length}</Badge>
              )}
            </TabsTrigger>
            </TabsList>

            {isLocalhost ? (
              <button
                type="button"
                className={
                  developerFieldsEnabled
                    ? "px-3 py-1.5 rounded-md bg-white text-purple-900 text-xs font-semibold"
                    : "px-3 py-1.5 rounded-md bg-purple-950/40 text-purple-200 text-xs font-medium border border-purple-200/20"
                }
                onClick={() => setDeveloperFieldsEnabled((v) => !v)}
              >
                Developer fields: {developerFieldsEnabled ? "On" : "Off"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="bg-amber-50/50">
          <TabsContent value="overview" className="m-0 p-4 lg:p-6">
            <Overviewtab
              tuFile={tuFile}
              exFile={exFile}
              eqFile={eqFile}
              allKeys={allKeys}
              showFullKeys={developerFieldsEnabled ? showFullKeys : false}
              setShowFullKeys={setShowFullKeys}
              developerFieldsEnabled={developerFieldsEnabled && isLocalhost}
              onSendToLetter={onSendToLetter}
            />
          </TabsContent>

          <TabsContent value="personal" className="m-0 p-4 lg:p-6">
            <PersonalInfoTab tuFile={tuFile} exFile={exFile} eqFile={eqFile} showFullKeys={developerFieldsEnabled ? showFullKeys : false} />
          </TabsContent>

          <TabsContent value="accounts" className="m-0 p-4 lg:p-6">
            <AccountsTab tuFile={tuFile} exFile={exFile} eqFile={eqFile} showFullKeys={developerFieldsEnabled ? showFullKeys : false} />
          </TabsContent>

          <TabsContent value="disputes" className="m-0 p-4">
              <DisputesTab onSendToLetter={onSendToLetter} importedFiles={importedFiles} assignments={assignments}/>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
