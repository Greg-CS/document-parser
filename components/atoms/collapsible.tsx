"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  badge?: React.ReactNode;
}

export function Collapsible({
  title,
  defaultOpen = true,
  children,
  className,
  headerClassName,
  contentClassName,
  badge,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn("rounded-lg border border-stone-200 bg-white overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-4 py-3 text-left",
          "bg-stone-50 hover:bg-stone-100 transition-colors",
          headerClassName
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-800">{title}</span>
          {badge}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-stone-500 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn("p-4", contentClassName)}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function CollapsibleGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-3", className)}>{children}</div>;
}
