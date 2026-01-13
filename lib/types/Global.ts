export type AccountCategory = keyof typeof ACCOUNT_TYPE_CATEGORIES;

// Credit Report Account Type Categories
export const ACCOUNT_TYPE_CATEGORIES = {
  revolving: {
    label: "Revolving",
    description: "Credit cards, lines of credit, store cards",
    patterns: ["revolv", "credit_card", "creditcard", "line_of_credit", "loc"],
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  installment: {
    label: "Installment",
    description: "Auto loans, student loans, personal loans",
    patterns: ["install", "auto_loan", "student", "personal_loan", "car_loan"],
    color: "bg-green-50 border-green-200 text-green-700",
  },
  mortgage: {
    label: "Mortgage",
    description: "Home loans, HELOCs, real estate",
    patterns: ["mortgage", "home_loan", "heloc", "real_estate", "realestate"],
    color: "bg-purple-50 border-purple-200 text-purple-700",
  },
  open: {
    label: "Open",
    description: "Charge cards, utility accounts, 30-day accounts",
    patterns: ["open", "charge_card", "utility", "30_day"],
    color: "bg-cyan-50 border-cyan-200 text-cyan-700",
  },
  collection: {
    label: "Collection",
    description: "Accounts sent to collection agencies",
    patterns: ["collection", "collector", "debt_buyer"],
    color: "bg-orange-50 border-orange-200 text-orange-700",
  },
  chargeoff: {
    label: "Charge-Off",
    description: "Accounts written off as bad debt",
    patterns: ["charge_off", "chargeoff", "charged_off", "written_off", "writeoff"],
    color: "bg-red-50 border-red-200 text-red-700",
  },
  derogatory: {
    label: "Derogatory",
    description: "Late payments, bankruptcies, judgments, liens",
    patterns: ["derogatory", "late_payment", "bankruptcy", "judgment", "lien", "foreclosure"],
    color: "bg-rose-50 border-rose-200 text-rose-700",
  },
  inquiry: {
    label: "Inquiries",
    description: "Hard and soft credit inquiries",
    patterns: ["inquiry", "inquiries", "hard_pull", "soft_pull"],
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  publicrecord: {
    label: "Public Records",
    description: "Bankruptcies, tax liens, civil judgments",
    patterns: ["public_record", "publicrecord", "tax_lien", "civil_judgment"],
    color: "bg-slate-50 border-slate-200 text-slate-700",
  },
} as const;

// Field definitions with tooltips
export const FIELD_DEFINITIONS: Record<string, string> = {
  "AccountIdentifier": "Unique identifier for the account",
  "AccountType": "Type of credit account (revolving, installment, etc.)",
  "AccountStatus": "Current status of the account",
  "Balance": "Current outstanding balance",
  "CreditLimit": "Maximum credit available",
  "DerogatoryDataIndicator": "Indicates presence of negative information",
};

export const CLAMP_2 =
  "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]";

export type BureauType = "transunion" | "experian" | "equifax"