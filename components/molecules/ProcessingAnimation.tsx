"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProcessingAnimationProps {
  stage?: "uploading" | "parsing" | "merging" | "analyzing" | "complete";
  progress?: number;
  message?: string;
  subMessage?: string;
  className?: string;
}

const STAGE_CONFIG = {
  uploading: { label: "Uploading files", icon: "📤" },
  parsing: { label: "Parsing credit reports", icon: "📄" },
  merging: { label: "Merging accounts", icon: "🔗" },
  analyzing: { label: "Analyzing data", icon: "🔍" },
  complete: { label: "Complete!", icon: "✅" },
};

export function ProcessingAnimation({
  stage = "parsing",
  progress = 0,
  message,
  subMessage,
  className,
}: ProcessingAnimationProps) {
  const config = STAGE_CONFIG[stage];
  const displayMessage = message || config.label;

  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-8", className)}>
      {/* Animated Report Cards */}
      <div className="relative h-[180px] w-[400px] mb-8">
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-200/30 via-transparent to-transparent rounded-3xl blur-2xl" />
        
        {/* Three floating report cards */}
        <div className="relative flex items-center justify-center gap-4 h-full">
          {/* TransUnion Card */}
          <div 
            className="relative w-28 h-36 rounded-lg bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-xl transform transition-all duration-1000 ease-in-out animate-float-left"
            style={{ animationDelay: "0s" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg" />
            <div className="p-3 h-full flex flex-col">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[8px] font-bold px-2 py-1 rounded mb-2 text-center shadow-sm">
                TransUnion
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 bg-slate-200 rounded-full w-full animate-pulse" />
                <div className="h-1.5 bg-green-300 rounded-full w-3/4" />
                <div className="h-1.5 bg-slate-200 rounded-full w-5/6 animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="h-1.5 bg-slate-200 rounded-full w-2/3 animate-pulse" style={{ animationDelay: "0.4s" }} />
                <div className="h-1.5 bg-green-300 rounded-full w-4/5" />
              </div>
            </div>
          </div>

          {/* Experian Card (center, larger) */}
          <div 
            className="relative w-32 h-40 rounded-lg bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-2xl transform transition-all duration-1000 ease-in-out z-10 animate-float-center"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-lg" />
            <div className="p-3 h-full flex flex-col">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[8px] font-bold px-2 py-1 rounded mb-2 text-center shadow-sm">
                Experian
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 bg-slate-200 rounded-full w-full animate-pulse" />
                <div className="h-1.5 bg-green-300 rounded-full w-4/5" />
                <div className="h-1.5 bg-slate-200 rounded-full w-full animate-pulse" style={{ animationDelay: "0.1s" }} />
                <div className="h-1.5 bg-slate-200 rounded-full w-3/4 animate-pulse" style={{ animationDelay: "0.3s" }} />
                <div className="h-1.5 bg-green-300 rounded-full w-2/3" />
                <div className="h-1.5 bg-slate-200 rounded-full w-5/6 animate-pulse" style={{ animationDelay: "0.5s" }} />
              </div>
            </div>
          </div>

          {/* Equifax Card */}
          <div 
            className="relative w-28 h-36 rounded-lg bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-xl transform transition-all duration-1000 ease-in-out animate-float-right"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-lg" />
            <div className="p-3 h-full flex flex-col">
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white text-[8px] font-bold px-2 py-1 rounded mb-2 text-center shadow-sm">
                Equifax
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 bg-slate-200 rounded-full w-5/6 animate-pulse" />
                <div className="h-1.5 bg-green-300 rounded-full w-full" />
                <div className="h-1.5 bg-slate-200 rounded-full w-2/3 animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="h-1.5 bg-slate-200 rounded-full w-4/5 animate-pulse" style={{ animationDelay: "0.4s" }} />
                <div className="h-1.5 bg-green-300 rounded-full w-3/4" />
              </div>
            </div>
          </div>
        </div>

        {/* Connecting lines animation */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(147, 51, 234)" stopOpacity="0" />
              <stop offset="50%" stopColor="rgb(147, 51, 234)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="rgb(147, 51, 234)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line 
            x1="95" y1="90" x2="145" y2="90" 
            stroke="url(#lineGradient)" 
            strokeWidth="2" 
            className="animate-pulse"
          />
          <line 
            x1="255" y1="90" x2="305" y2="90" 
            stroke="url(#lineGradient)" 
            strokeWidth="2" 
            className="animate-pulse"
            style={{ animationDelay: "0.5s" }}
          />
        </svg>
      </div>

      {/* Status Text */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-slate-800 mb-1">{displayMessage}</h3>
        {subMessage && (
          <p className="text-sm text-slate-500">{subMessage}</p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
            style={{ width: `${Math.max(5, progress)}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
        {progress > 0 && (
          <div className="text-center mt-2 text-xs text-slate-500">{Math.round(progress)}%</div>
        )}
      </div>
    </div>
  );
}

// Mini version for inline use
export function ProcessingAnimationMini({
  message = "Processing...",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-3 py-4", className)}>
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
      </div>
      <span className="text-sm text-slate-600">{message}</span>
    </div>
  );
}
