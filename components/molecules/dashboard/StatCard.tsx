"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type ImpactLevel = "high" | "medium" | "low";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  impact?: ImpactLevel;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

const impactStyles: Record<ImpactLevel, { badge: string; text: string }> = {
  high: { badge: "bg-red-100 text-red-700 border-red-200", text: "High Impact" },
  medium: { badge: "bg-amber-100 text-amber-700 border-amber-200", text: "Medium Impact" },
  low: { badge: "bg-green-100 text-green-700 border-green-200", text: "Low Impact" },
};

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  impact, 
  trend,
  trendValue,
  className 
}: StatCardProps) {
  return (
    <div className={cn(
      "relative rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow",
      className
    )}>
      {/* Icon */}
      {Icon && (
        <div className="absolute top-3 right-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-slate-600" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="pr-12">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{value}</span>
          {trend && trendValue && (
            <span className={cn(
              "text-xs font-medium",
              trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-slate-500"
            )}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : ""} {trendValue}
            </span>
          )}
        </div>
        {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
      </div>

      {/* Impact badge */}
      {impact && (
        <div className={cn(
          "absolute bottom-3 right-3 text-[10px] font-medium px-2 py-0.5 rounded-full border",
          impactStyles[impact].badge
        )}>
          {impactStyles[impact].text}
        </div>
      )}
    </div>
  );
}
