import { CLAMP_2 } from "@/lib/types/Global";
import { cn, normalizeTextDisplay, stringifyPrimitive } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/atoms/tooltip";
import { AlertCircle, HelpCircle } from "lucide-react";

// Field descriptions for common credit report fields
const FIELD_DESCRIPTIONS: Record<string, string> = {
  // Personal Information
  "birth date": "The consumer's date of birth as reported to the credit bureau.",
  "birthdate": "The consumer's date of birth as reported to the credit bureau.",
  "date of birth": "The consumer's date of birth as reported to the credit bureau.",
  "dob": "The consumer's date of birth as reported to the credit bureau.",
  "first name": "The consumer's first/given name on file.",
  "firstname": "The consumer's first/given name on file.",
  "last name": "The consumer's last/family name on file.",
  "lastname": "The consumer's last/family name on file.",
  "middle name": "The consumer's middle name or initial.",
  "middlename": "The consumer's middle name or initial.",
  "name": "The consumer's full name on file.",
  "print position type": "Indicates the role of the person on the account (e.g., borrower, co-borrower).",
  "ssn": "Social Security Number (masked for privacy).",
  "social security": "Social Security Number (masked for privacy).",
  "unparsed name": "The full name as a single string before parsing.",
  "borrower residency type": "Current residency status of the borrower.",
  "address": "The consumer's mailing or residential address.",
  "street": "The street address component.",
  "city": "The city component of the address.",
  "state": "The state component of the address.",
  "zip": "The ZIP/postal code component of the address.",
  "postal": "The postal code component of the address.",
  "phone": "The consumer's phone number on file.",
  "email": "The consumer's email address on file.",
  "employer": "The consumer's current or previous employer.",
  "employment": "The consumer's employment information.",
  "income": "The consumer's reported income.",
  "borrower": "Information about the primary borrower.",
  // Account Information
  "account number": "The unique identifier for the credit account.",
  "account type": "The type of credit account (e.g., revolving, installment).",
  "account status": "Current status of the account (e.g., open, closed, paid).",
  "balance": "The current outstanding balance on the account.",
  "current balance": "The current outstanding balance on the account.",
  "credit limit": "The maximum credit available on the account.",
  "payment status": "The current payment status (e.g., current, 30 days late).",
  "date opened": "The date the account was originally opened.",
  "date closed": "The date the account was closed, if applicable.",
  "high balance": "The highest balance ever recorded on the account.",
  "monthly payment": "The required monthly payment amount.",
  "creditor name": "The name of the creditor or lender.",
  "original creditor": "The original creditor before any transfers or collections.",
  "subscriber name": "The name of the data furnisher reporting to the bureau.",
  "collection": "Account that has been sent to collections.",
  "charge off": "Account that the creditor has written off as a loss.",
  "derogatory": "Negative information that may impact credit score.",
};

interface CategoryConfig {
  label: string;
  description: string;
  patterns: readonly string[];
  color: string;
}

interface RowProps {
  label: string;
  shortLabel: string;
  values: [unknown, unknown, unknown];
  showFullKey?: boolean;
  categoryConfig?: CategoryConfig;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable]";
  }
}

function getFieldDescription(label: string): string | undefined {
  const normalized = label.toLowerCase().trim();
  return FIELD_DESCRIPTIONS[normalized];
}

function renderCellValue(value: unknown, displayLabel?: string) {
  if (value === undefined || value === null) return "—";
  if (typeof value === "object") {
    const summary = Array.isArray(value) ? `[${value.length} items]` : "{...}";
    return (
      <details className="group inline-block text-left">
        <summary className="cursor-pointer select-none text-stone-600 underline decoration-dotted underline-offset-2">
          {summary}
        </summary>
        <pre className="mt-2 whitespace-pre-wrap wrap-break-word rounded-md bg-white/60 p-2 text-xs text-stone-700">
          {safeJsonStringify(value)}
        </pre>
      </details>
    );
  }
  const stringValue = stringifyPrimitive(value);
  const display = typeof value === "string" ? normalizeTextDisplay(stringValue) : stringValue;
  
  // Check if value matches the label (placeholder case)
  const isPlaceholder = displayLabel && 
    String(display).toLowerCase().trim() === displayLabel.toLowerCase().trim();
  
  if (isPlaceholder) {
    const description = getFieldDescription(displayLabel);
    if (description) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(CLAMP_2, "wrap-break-word flex items-center justify-center gap-1 text-stone-400 cursor-help")}>
              <span className="italic">{display}</span>
              <HelpCircle className="w-3 h-3 text-stone-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {description}
          </TooltipContent>
        </Tooltip>
      );
    }
    // No description available, show as placeholder style
    return (
      <div className={cn(CLAMP_2, "wrap-break-word text-stone-400 italic")} title={String(display)}>
        {display}
      </div>
    );
  }
  
  return (
    <div className={cn(CLAMP_2, "wrap-break-word")} title={String(display)}>
      {display}
    </div>
  );
}

export function ReportRow({ label, shortLabel, values, showFullKey, categoryConfig }: RowProps) {
  const displayLabel = showFullKey ? label : normalizeTextDisplay(shortLabel);
  const displayTitle = showFullKey ? label : displayLabel;
  
  // Determine if this is a derogatory/negative category
  const isNegativeCategory = categoryConfig && 
    ["collection", "chargeoff", "derogatory"].some(cat => 
      categoryConfig.label.toLowerCase().includes(cat.replace("off", "-off"))
    );
  
  return (
    <tr className={cn(
      "hover:bg-amber-100/40 transition-colors",
      categoryConfig && `border-l-4 ${categoryConfig.color.split(" ")[1]}`
    )}>
      <td
        className="py-2 px-3 text-sm font-medium text-stone-700 border-r border-amber-200/80 align-top"
        title={displayTitle}
      >
        {categoryConfig && (
          <div className="flex items-center gap-2 mb-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
                  categoryConfig.color
                )}>
                  {isNegativeCategory && <AlertCircle className="w-3 h-3" />}
                  {categoryConfig.label}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {categoryConfig.description}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        <div className={cn(CLAMP_2, "wrap-break-word")}>{displayLabel}</div>
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 border-r border-amber-200/80 align-top">
        {renderCellValue(values[0], displayLabel)}
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 border-r border-amber-200/80 align-top">
        {renderCellValue(values[1], displayLabel)}
      </td>
      <td className="py-2 px-3 text-sm text-center text-stone-600 align-top">
        {renderCellValue(values[2], displayLabel)}
      </td>
    </tr>
  );
}