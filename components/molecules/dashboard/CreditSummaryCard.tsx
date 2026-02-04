"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "./ScoreGauge";
import { ChevronRight } from "lucide-react";

interface CreditSummaryCardProps {
  score: number;
  bureau: string;
  pointsToNextLevel?: number;
  nextLevelName?: string;
  onViewDetails?: () => void;
  className?: string;
}

export function CreditSummaryCard({
  score,
  bureau,
  pointsToNextLevel,
  nextLevelName,
  onViewDetails,
  className,
}: CreditSummaryCardProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-6 text-white shadow-xl",
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold">Credit Score Overview</h3>
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
          <div className="w-4 h-4 rounded border-2 border-white/60" />
        </div>
      </div>

      <div className="flex justify-center">
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <ScoreGauge score={score} bureau={bureau} />
        </div>
      </div>

      {pointsToNextLevel && nextLevelName && (
        <div className="mt-4 text-center text-sm text-slate-300">
          <span className="font-semibold text-white">{pointsToNextLevel} pts</span> more to reach {nextLevelName}
        </div>
      )}

      {onViewDetails && (
        <button
          type="button"
          onClick={onViewDetails}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-300 hover:text-white transition-colors"
        >
          View Score Changes
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
