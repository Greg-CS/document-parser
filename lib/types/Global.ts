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

export const CLAMP_2 =
  "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]";

export type BureauType = "transunion" | "experian" | "equifax"

export type CreditComment = { code?: string; text?: string };
