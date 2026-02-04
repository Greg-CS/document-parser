"use client";

import React from "react";
import { TransUnionLogo, ExperianLogo, EquifaxLogo } from "@/components/molecules/icons/CreditBureauIcons";
import { cn } from "@/lib/utils";
import { AlertTriangle, CreditCard, Clock, Search, TrendingUp, Wallet, Calendar, CheckCircle2, XCircle } from "lucide-react";
import type { ImportedFile } from "@/lib/interfaces/GlobalInterfaces";
import { ScoreGauge, StatCard } from "@/components/molecules/dashboard";
import { extractCreditMetrics } from "@/lib/credit-metrics";
import { Badge } from "@/components/atoms/badge";

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

export const Overviewtab = ({ tuFile, exFile, eqFile }: OverviewTabProps) => {
  // Extract metrics from the first available file
  const primaryData = tuFile?.data ?? exFile?.data ?? eqFile?.data;
  const metrics = React.useMemo(() => extractCreditMetrics(primaryData), [primaryData]);

  // Get individual bureau scores
  const tuScore = metrics.scores.find(s => s.bureau === "transunion");
  const exScore = metrics.scores.find(s => s.bureau === "experian");
  const eqScore = metrics.scores.find(s => s.bureau === "equifax");

  const hasData = tuFile || exFile || eqFile;

  if (!hasData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <div className="text-slate-500 text-sm">No credit report data loaded</div>
        <div className="text-slate-400 text-xs mt-1">Upload a credit report to see your overview</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Credit Report Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">Summary of your credit profile across all bureaus</p>
        </div>
        <div className="flex items-center gap-2">
          {tuFile && <Badge variant="outline" className="text-xs"><TransUnionLogo /></Badge>}
          {exFile && <Badge variant="outline" className="text-xs"><ExperianLogo /></Badge>}
          {eqFile && <Badge variant="outline" className="text-xs"><EquifaxLogo /></Badge>}
        </div>
      </div>

      {/* Credit Scores Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-tour="score-summary">
        {/* Main Score Card */}
        <div className="lg:col-span-1 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-6 text-white shadow-xl">
          <h3 className="text-lg font-semibold mb-4">Credit Score</h3>
          <div className="bg-white rounded-xl p-4">
            <ScoreGauge 
              score={metrics.averageScore || 720} 
              bureau={tuScore ? "TransUnion" : exScore ? "Experian" : "Equifax"} 
            />
          </div>
          {metrics.averageScore > 0 && metrics.averageScore < 740 && (
            <div className="mt-4 text-center text-sm text-slate-300">
              <span className="font-semibold text-white">{740 - metrics.averageScore} pts</span> more to reach Very Good
            </div>
          )}
        </div>

        {/* Bureau Scores */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* TransUnion */}
          <div className={cn(
            "rounded-xl border p-4 transition-all",
            tuScore ? "bg-white border-blue-200 shadow-sm" : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <TransUnionLogo />
            </div>
            {tuScore ? (
              <>
                <div className="text-3xl font-bold text-slate-900">{tuScore.score}</div>
                <div className="text-xs text-slate-500 mt-1">{tuScore.date || "Recent"}</div>
              </>
            ) : (
              <div className="text-sm text-slate-400">No data</div>
            )}
          </div>

          {/* Experian */}
          <div className={cn(
            "rounded-xl border p-4 transition-all",
            exScore ? "bg-white border-blue-200 shadow-sm" : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <ExperianLogo />
            </div>
            {exScore ? (
              <>
                <div className="text-3xl font-bold text-slate-900">{exScore.score}</div>
                <div className="text-xs text-slate-500 mt-1">{exScore.date || "Recent"}</div>
              </>
            ) : (
              <div className="text-sm text-slate-400">No data</div>
            )}
          </div>

          {/* Equifax */}
          <div className={cn(
            "rounded-xl border p-4 transition-all",
            eqScore ? "bg-white border-green-200 shadow-sm" : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <EquifaxLogo />
            </div>
            {eqScore ? (
              <>
                <div className="text-3xl font-bold text-slate-900">{eqScore.score}</div>
                <div className="text-xs text-slate-500 mt-1">{eqScore.date || "Recent"}</div>
              </>
            ) : (
              <div className="text-sm text-slate-400">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Payment History"
          value={`${metrics.paymentHistoryPercent}%`}
          subtitle="On-time payments"
          icon={CheckCircle2}
          impact={metrics.paymentHistoryPercent >= 95 ? "low" : metrics.paymentHistoryPercent >= 80 ? "medium" : "high"}
        />
        <StatCard
          title="Credit Usage"
          value={`${metrics.creditUtilization}%`}
          subtitle="Of available credit"
          icon={CreditCard}
          impact={metrics.creditUtilization <= 30 ? "low" : metrics.creditUtilization <= 50 ? "medium" : "high"}
        />
        <StatCard
          title="Credit Inquiries"
          value={metrics.inquiriesCount}
          subtitle="Hard inquiries"
          icon={Search}
          impact={metrics.inquiriesCount <= 2 ? "low" : metrics.inquiriesCount <= 5 ? "medium" : "high"}
        />
        <StatCard
          title="Account Age"
          value={metrics.oldestAccountAge || "N/A"}
          subtitle="Oldest account"
          icon={Calendar}
          impact="low"
        />
        <StatCard
          title="Total Accounts"
          value={metrics.totalAccounts}
          subtitle={`${metrics.openAccounts} open, ${metrics.closedAccounts} closed`}
          icon={Wallet}
        />
        <StatCard
          title="Negative Items"
          value={metrics.negativeAccounts}
          subtitle={metrics.collectionsCount > 0 ? `${metrics.collectionsCount} collections` : "No collections"}
          icon={metrics.negativeAccounts > 0 ? AlertTriangle : CheckCircle2}
          impact={metrics.negativeAccounts === 0 ? "low" : metrics.negativeAccounts <= 2 ? "medium" : "high"}
        />
      </div>

      {/* Account Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Positive Factors */}
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-800">Positive Factors</h3>
          </div>
          <ul className="space-y-2 text-sm text-green-700">
            {metrics.paymentHistoryPercent >= 95 && (
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Excellent payment history ({metrics.paymentHistoryPercent}% on-time)
              </li>
            )}
            {metrics.creditUtilization <= 30 && (
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Low credit utilization ({metrics.creditUtilization}%)
              </li>
            )}
            {metrics.negativeAccounts === 0 && (
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                No negative items on report
              </li>
            )}
            {metrics.totalAccounts >= 5 && (
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Good mix of credit accounts ({metrics.totalAccounts} total)
              </li>
            )}
            {metrics.paymentHistoryPercent < 95 && metrics.creditUtilization > 30 && metrics.negativeAccounts > 0 && metrics.totalAccounts < 5 && (
              <li className="text-slate-500 italic">No significant positive factors identified</li>
            )}
          </ul>
        </div>

        {/* Areas for Improvement */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Areas for Improvement</h3>
          </div>
          <ul className="space-y-2 text-sm text-amber-700">
            {metrics.negativeAccounts > 0 && (
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {metrics.negativeAccounts} negative item{metrics.negativeAccounts !== 1 ? "s" : ""} affecting your score
              </li>
            )}
            {metrics.creditUtilization > 30 && (
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Credit utilization is {metrics.creditUtilization}% (aim for under 30%)
              </li>
            )}
            {metrics.inquiriesCount > 2 && (
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {metrics.inquiriesCount} recent inquiries may be impacting your score
              </li>
            )}
            {metrics.paymentHistoryPercent < 95 && (
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Payment history is {metrics.paymentHistoryPercent}% (aim for 100%)
              </li>
            )}
            {metrics.negativeAccounts === 0 && metrics.creditUtilization <= 30 && metrics.inquiriesCount <= 2 && metrics.paymentHistoryPercent >= 95 && (
              <li className="text-slate-500 italic">No significant issues identified</li>
            )}
          </ul>
        </div>
      </div>

      {/* Balance Summary */}
      {metrics.totalBalance > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Balance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Total Balance</div>
              <div className="text-xl font-bold text-slate-900">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(metrics.totalBalance)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Total Credit Limit</div>
              <div className="text-xl font-bold text-slate-900">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(metrics.totalCreditLimit)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Available Credit</div>
              <div className="text-xl font-bold text-green-600">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(metrics.totalCreditLimit - metrics.totalBalance)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Utilization</div>
              <div className={cn(
                "text-xl font-bold",
                metrics.creditUtilization <= 30 ? "text-green-600" : metrics.creditUtilization <= 50 ? "text-amber-600" : "text-red-600"
              )}>
                {metrics.creditUtilization}%
              </div>
            </div>
          </div>
          {/* Utilization bar */}
          <div className="mt-4">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  metrics.creditUtilization <= 30 ? "bg-green-500" : metrics.creditUtilization <= 50 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${Math.min(100, metrics.creditUtilization)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-500">
              <span>0%</span>
              <span className="text-green-600">30% (Good)</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
