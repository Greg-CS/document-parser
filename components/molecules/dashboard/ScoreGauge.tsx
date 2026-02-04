"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  bureau?: string;
  className?: string;
}

function getScoreCategory(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 800) return { label: "Excellent", color: "text-emerald-600", bgColor: "bg-emerald-500" };
  if (score >= 740) return { label: "Very Good", color: "text-green-600", bgColor: "bg-green-500" };
  if (score >= 670) return { label: "Good", color: "text-lime-600", bgColor: "bg-lime-500" };
  if (score >= 580) return { label: "Fair", color: "text-amber-600", bgColor: "bg-amber-500" };
  return { label: "Poor", color: "text-red-600", bgColor: "bg-red-500" };
}

function getScoreRotation(score: number): number {
  const min = 300;
  const max = 850;
  const clamped = Math.max(min, Math.min(max, score));
  const percentage = (clamped - min) / (max - min);
  return -90 + percentage * 180;
}

export function ScoreGauge({ score, bureau, className }: ScoreGaugeProps) {
  const category = getScoreCategory(score);
  const rotation = getScoreRotation(score);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      {/* Gauge background */}
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Semi-circle background */}
        <div className="absolute inset-0 rounded-t-full bg-gradient-to-r from-red-400 via-amber-400 via-lime-400 to-emerald-400" />
        
        {/* Inner white semi-circle */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-18 rounded-t-full bg-white" style={{ height: '72px' }} />
        
        {/* Needle */}
        <div 
          className="absolute bottom-0 left-1/2 origin-bottom w-1 h-20 -translate-x-1/2 transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        >
          <div className="w-1 h-16 bg-gradient-to-t from-slate-800 to-slate-600 rounded-full" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-800" />
        </div>
      </div>

      {/* Score display */}
      <div className="mt-2 text-center">
        <div className="text-4xl font-bold text-slate-900">{score}</div>
        {bureau && <div className="text-xs text-slate-500 mt-0.5">Based on {bureau} data</div>}
        <div className={cn("inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-medium text-white", category.bgColor)}>
          {category.label}
        </div>
      </div>

      {/* Scale labels */}
      <div className="flex justify-between w-48 mt-2 text-xs text-slate-500">
        <span>300</span>
        <span>850</span>
      </div>
    </div>
  );
}
