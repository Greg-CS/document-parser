/**
 * Credit Dispute Field Definitions
 * Defines patterns for identifying negative/disputable items in credit reports
 */

// Fields that indicate negative items when they have certain values
export const NEGATIVE_INDICATOR_FIELDS = [
  // Collection indicators
  "@IsCollectionIndicator",
  "@IsChargeoffIndicator",
  "@_DerogatoryDataIndicator",
  "@_ConsumerDisputeIndicator",
  
  // Late payments
  "@_LATE_COUNT.@_30Days",
  "@_LATE_COUNT.@_60Days",
  "@_LATE_COUNT.@_90Days",
  "_LATE_COUNT",
  
  // Adverse ratings
  "@_HIGHEST_ADVERSE_RATING",
  "@_MOST_RECENT_ADVERSE_RATING",
  "@_CURRENT_RATING",
  "_CURRENT_RATING.@_Code",
  "_CURRENT_RATING.@_Type",
  
  // Charge-off data
  "@_ChargeOffAmount",
  "@_ChargeOffDate",
  "@_PastDueAmount",
  "@_FirstDelinquencyDate",
  
  // Account status issues
  "@_AccountStatusType",
  "@RawAccountStatus",
  "@IsClosedIndicator",
  "@IsMortgageIndicator",
  
  // Payment patterns (critical - shows month-by-month payment history)
  "_PAYMENT_PATTERN",
  "_PAYMENT_PATTERN.@_Data",
  
  // Credit comments (often contain derogatory info)
  "CREDIT_COMMENT",
  "@_Code",
  "@_Type",
  
  // Public records
  "CREDIT_PUBLIC_RECORD",
  "@_BankruptcyType",
  "@_CourtName",
  
  // Repossession/Foreclosure
  "@IsRepossessionIndicator",
  "@IsForeclosureIndicator",
] as const

// Field patterns that are always considered negative when present with non-zero/non-empty values
export const NEGATIVE_VALUE_PATTERNS: Record<string, (value: unknown) => boolean> = {
  // Boolean indicators - true means negative
  "IsCollectionIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  "IsChargeoffIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  "DerogatoryDataIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  "ConsumerDisputeIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  "IsClosedIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  "IsRepossessionIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  "IsForeclosureIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  
  // Numeric fields - non-zero means negative
  "_30Days": (v) => typeof v === "number" ? v > 0 : parseInt(String(v), 10) > 0,
  "_60Days": (v) => typeof v === "number" ? v > 0 : parseInt(String(v), 10) > 0,
  "_90Days": (v) => typeof v === "number" ? v > 0 : parseInt(String(v), 10) > 0,
  "ChargeOffAmount": (v) => typeof v === "number" ? v > 0 : parseFloat(String(v)) > 0,
  "PastDueAmount": (v) => typeof v === "number" ? v > 0 : parseFloat(String(v)) > 0,
  
  // Payment pattern data - contains codes like 1,2,3,4,5,6,7,8,9,X (30-180+ days late)
  "PAYMENT_PATTERN": (v) => {
    if (typeof v === "object" && v !== null) {
      const data = (v as Record<string, unknown>)["@_Data"] || (v as Record<string, unknown>)["Data"];
      if (typeof data === "string") {
        // Check for any late payment codes: 1-9 or X
        return /[1-9X]/.test(data);
      }
    }
    if (typeof v === "string") {
      return /[1-9X]/.test(v);
    }
    return false;
  },
  
  // Rating codes - certain codes indicate negative (Metro 2 codes)
  "_Code": (v) => {
    const negativeRatingCodes = [
      "2", "3", "4", "5", "6", "7", "8", "9", // 30-180+ days late
      "CA", "CO", "FC", "BK", "LS", "DA", "PN", "RF", "RP", "VS", "WO"
    ];
    return negativeRatingCodes.includes(String(v).toUpperCase());
  },
  
  // Rating type - certain types indicate issues
  "_Type": (v) => {
    const negativeTypes = [
      "CollectionOrChargeOff", "Delinquent", "Late", "PastDue",
      "Repossession", "Foreclosure", "Bankruptcy", "ChargeOff"
    ];
    const val = String(v);
    return negativeTypes.some(s => val.includes(s));
  },
  
  // Account status - certain statuses are negative
  "AccountStatusType": (v) => {
    const negativeStatuses = [
      "Chargeoff", "Collection", "Delinquent", "Late", "PastDue",
      "Repossession", "Foreclosure", "Bankruptcy", "Closed"
    ];
    const val = String(v).toLowerCase();
    return negativeStatuses.some(s => val.includes(s.toLowerCase()));
  },
  
  // Comment codes - certain codes indicate derogatory info
  "CREDIT_COMMENT": (v) => {
    if (typeof v === "object" && v !== null) {
      const code = (v as Record<string, unknown>)["@_Code"];
      const type = (v as Record<string, unknown>)["@_Type"];
      // Derogatory comment codes
      const negativeCommentCodes = ["AC", "AU", "CO", "DA", "FC", "LS", "PN", "RF", "RP", "VS", "WO"];
      if (code && negativeCommentCodes.includes(String(code).toUpperCase())) return true;
      if (type && String(type).toLowerCase().includes("derogatory")) return true;
    }
    return false;
  },
}

const EXCLUDED_DISPUTE_FIELD_PATH_PARTS = [
  "DEROGATORYDATAINDICATOR",
  "CONSUMERDISPUTEINDICATOR",
  "FIRSTDELINQUENCYDATESOURCETYPE",
  "ISCOLLECTIONINDICATOR",
  "ISCHARGEOFFINDICATOR",
] as const

function shouldSurfaceDisputeItem(fieldPath: string): boolean {
  const path = fieldPath.toUpperCase()
  return !EXCLUDED_DISPUTE_FIELD_PATH_PARTS.some((p) => path.includes(p))
}

export { shouldSurfaceDisputeItem }

// Categories for grouping dispute items
export type DisputeCategory = 
  | "collections"
  | "chargeoffs"
  | "late_payments"
  | "inquiries"
  | "personal_info"
  | "public_records"
  | "accounts"

export interface DisputeItem {
  id: string
  category: DisputeCategory
  fieldPath: string
  fieldName: string
  value: unknown
  bureau: "transunion" | "experian" | "equifax"
  severity: "high" | "medium" | "low"
  reason: string
  accountIdentifier?: string
  creditorName?: string
  sourceAccount?: Record<string, unknown>
}

// Map field patterns to categories
export function getFieldCategory(fieldPath: string): DisputeCategory {
  const path = fieldPath.toUpperCase()
  
  if (path.includes("CREDIT_LIABILITY") && (
    path.includes("COLLECTION") || 
    path.includes("ISCOLLECTION")
  )) {
    return "collections"
  }
  
  if (path.includes("CHARGEOFF") || path.includes("CHARGE_OFF")) {
    return "chargeoffs"
  }
  
  if (
    path.includes("LATE_COUNT") || 
    path.includes("DELINQUENCY") || 
    path.includes("ADVERSE") ||
    path.includes("PAYMENT_PATTERN")
  ) {
    return "late_payments"
  }
  
  if (path.includes("CREDIT_INQUIRY")) {
    return "inquiries"
  }
  
  if (path.includes("BORROWER") && (
    path.includes("_NAME") || 
    path.includes("_SSN") || 
    path.includes("_RESIDENCE") ||
    path.includes("_BIRTHDATE")
  )) {
    return "personal_info"
  }
  
  if (
    path.includes("PUBLIC_RECORD") || 
    path.includes("BANKRUPTCY") ||
    path.includes("FORECLOSURE") ||
    path.includes("REPOSSESSION")
  ) {
    return "public_records"
  }
  
  return "accounts"
}

// Determine severity based on field type
export function getDisputeSeverity(fieldPath: string, value: unknown): "high" | "medium" | "low" {
  const path = fieldPath.toUpperCase()
  
  // High severity
  if (
    path.includes("COLLECTION") ||
    path.includes("CHARGEOFF") ||
    path.includes("BANKRUPTCY") ||
    path.includes("FORECLOSURE") ||
    path.includes("REPOSSESSION") ||
    path.includes("_90DAYS")
  ) {
    return "high"
  }
  
  // Check payment pattern for severity
  if (path.includes("PAYMENT_PATTERN")) {
    if (typeof value === "object" && value !== null) {
      const data = (value as Record<string, unknown>)["@_Data"] || (value as Record<string, unknown>)["Data"];
      if (typeof data === "string") {
        // 7,8,9,X = 150-180+ days late = high severity
        if (/[789X]/.test(data)) return "high";
        // 4,5,6 = 90-120 days late = medium severity
        if (/[456]/.test(data)) return "medium";
      }
    }
  }
  
  // Check rating codes for severity
  if (path.includes("_CODE") || path.includes("RATING")) {
    const code = String(value).toUpperCase();
    // Severe codes: CO (charge-off), FC (foreclosure), BK (bankruptcy), RP (repossession)
    if (["CO", "FC", "BK", "RP", "7", "8", "9"].includes(code)) return "high";
    // Medium codes: 4,5,6 (90-120 days late)
    if (["4", "5", "6", "DA", "LS"].includes(code)) return "medium";
  }
  
  // Medium severity
  if (
    path.includes("_60DAYS") ||
    path.includes("DEROGATORY") ||
    path.includes("ADVERSE") ||
    path.includes("PASTDUE") ||
    path.includes("ISCLOSED")
  ) {
    return "medium"
  }
  
  return "low"
}

// Check if a field value indicates a negative/disputable item
export function isNegativeValue(fieldPath: string, value: unknown): boolean {
  if (value === null || value === undefined || value === "" || value === "N" || value === false) {
    return false
  }
  
  // Check against known negative patterns
  for (const [pattern, checker] of Object.entries(NEGATIVE_VALUE_PATTERNS)) {
    if (fieldPath.includes(pattern)) {
      if (pattern === "_Code") {
        const path = fieldPath.toUpperCase()
        const isRatingContext = path.includes("RATING") || path.includes("ADVERSE")
        if (!isRatingContext) return false
      }
      return checker(value)
    }
  }
  
  // For dates in delinquency/chargeoff contexts, presence indicates negative
  if (
    (fieldPath.includes("Delinquency") || fieldPath.includes("ChargeOff")) &&
    /date$/i.test(fieldPath.split(".").pop() || "") &&
    value
  ) {
    return true
  }
  
  return false
}

// Build hierarchical structure from flat keys
export interface HierarchyNode {
  name: string
  fullPath: string
  children: Map<string, HierarchyNode>
  value?: unknown
  isNegative?: boolean
  severity?: "high" | "medium" | "low"
  category?: DisputeCategory
}

export function buildHierarchy(
  data: Record<string, unknown>,
  keys: string[]
): HierarchyNode {
  const root: HierarchyNode = {
    name: "root",
    fullPath: "",
    children: new Map(),
  }
  
  for (const key of keys) {
    const value = getValueAtPath(data, key)
    const parts = key.split(".")
    let current = root
    let pathSoFar = ""
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      pathSoFar = pathSoFar ? `${pathSoFar}.${part}` : part
      
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: pathSoFar,
          children: new Map(),
        })
      }
      
      current = current.children.get(part)!
      
      // If this is the last part, set the value and check if negative
      if (i === parts.length - 1) {
        current.value = value
        current.isNegative = isNegativeValue(key, value)
        if (current.isNegative) {
          current.severity = getDisputeSeverity(key, value)
          current.category = getFieldCategory(key)
        }
      }
    }
  }
  
  return root
}

// Helper to get value at a nested path
function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj
  const parts = path.replace(/\[\*\]/g, ".0").replace(/\[(\d+)\]/g, ".$1").split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

// Extract all dispute items from data
export function extractDisputeItems(
  data: Record<string, unknown>,
  keys: string[],
  bureau: "transunion" | "experian" | "equifax"
): DisputeItem[] {
  const items: DisputeItem[] = []
  
  for (const key of keys) {
    if (!shouldSurfaceDisputeItem(key)) continue
    const value = getValueAtPath(data, key)
    
    if (isNegativeValue(key, value)) {
      const category = getFieldCategory(key)
      const severity = getDisputeSeverity(key, value)
      
      // Try to extract account identifier, creditor name, and full source account from context
      let accountIdentifier: string | undefined
      let creditorName: string | undefined
      let sourceAccount: Record<string, unknown> | undefined
      
      if (key.includes("CREDIT_LIABILITY")) {
        const match = key.match(/CREDIT_LIABILITY\[(\d+)\]/)
        if (match) {
          const idx = match[1]
          accountIdentifier = getValueAtPath(data, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}].@_AccountIdentifier`) as string
          creditorName = getValueAtPath(data, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}]._CREDITOR.@_Name`) as string
          sourceAccount = getValueAtPath(data, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}]`) as Record<string, unknown>
        }
      }
      
      items.push({
        id: `${bureau}-${key}`,
        category,
        fieldPath: key,
        fieldName: key.split(".").pop() || key,
        value,
        bureau,
        severity,
        reason: generateDisputeReason(key, value),
        accountIdentifier,
        creditorName,
        sourceAccount,
      })
    }
  }
  
  const seen = new Set<string>()
  const deduped: DisputeItem[] = []
  for (const item of items) {
    const key = [
      item.bureau,
      item.category,
      item.creditorName || "",
      item.accountIdentifier || "",
      item.fieldPath,
      String(item.value),
    ].join("|")
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  return deduped
}

// Generate a human-readable dispute reason
export function generateDisputeReason(fieldPath: string, value: unknown): string {
  const path = fieldPath.toUpperCase()
  
  if (path.includes("COLLECTION")) {
    return "Account reported as collection"
  }
  if (path.includes("CHARGEOFF")) {
    return "Account charged off"
  }
  if (path.includes("REPOSSESSION")) {
    return "Account repossessed"
  }
  if (path.includes("FORECLOSURE")) {
    return "Property foreclosed"
  }
  if (path.includes("BANKRUPTCY")) {
    return "Bankruptcy reported"
  }
  if (path.includes("_30DAYS")) {
    return `${value} late payment(s) 30 days`
  }
  if (path.includes("_60DAYS")) {
    return `${value} late payment(s) 60 days`
  }
  if (path.includes("_90DAYS")) {
    return `${value} late payment(s) 90+ days`
  }
  
  // Payment pattern analysis
  if (path.includes("PAYMENT_PATTERN")) {
    if (typeof value === "object" && value !== null) {
      const data = (value as Record<string, unknown>)["@_Data"] || (value as Record<string, unknown>)["Data"];
      if (typeof data === "string") {
        const lateCount = (data.match(/[1-9X]/g) || []).length;
        const severe = /[789X]/.test(data);
        if (severe) {
          return `Payment history shows ${lateCount} late payment(s) including 150+ days late`;
        }
        return `Payment history shows ${lateCount} late payment(s)`;
      }
    }
    return "Late payments in payment history";
  }
  
  // Rating code analysis
  if (path.includes("_CODE") && path.includes("RATING")) {
    const code = String(value).toUpperCase();
    const codeMap: Record<string, string> = {
      "CO": "Charge-off",
      "FC": "Foreclosure",
      "BK": "Bankruptcy",
      "RP": "Repossession",
      "LS": "Lease/Loan assumed",
      "DA": "Delete entire account",
      "2": "30 days late",
      "3": "60 days late",
      "4": "90 days late",
      "5": "120 days late",
      "6": "150 days late",
      "7": "180 days late",
      "8": "Charge-off",
      "9": "Collection",
    };
    return codeMap[code] || `Negative rating code: ${code}`;
  }
  
  if (path.includes("PASTDUE")) {
    const num = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""))
    const formatted = Number.isFinite(num)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num)
      : String(value)
    return `Past due amount: ${formatted}`
  }
  if (path.includes("FIRSTDELINQUENCYDATE")) {
    return "First delinquency date reported"
  }
  if (path.includes("DEROGATORY")) {
    return "Derogatory data reported"
  }
  if (path.includes("_MOST_RECENT_ADVERSE_RATING")) {
    return "Most recent adverse rating on account"
  }
  if (path.includes("_HIGHEST_ADVERSE_RATING")) {
    return "Highest adverse rating on account"
  }
  if (path.includes("ADVERSE")) {
    return "Adverse rating on account"
  }
  if (path.includes("ISCLOSED")) {
    return "Account closed"
  }
  if (path.includes("CREDIT_COMMENT")) {
    if (typeof value === "object" && value !== null) {
      const code = (value as Record<string, unknown>)["@_Code"];
      if (code) return `Comment code: ${code}`;
    }
    return "Derogatory comment on account";
  }
  
  return "Potential dispute item"
}

// Severity colors for UI
export const SEVERITY_COLORS = {
  high: {
    bg: "bg-red-100",
    border: "border-red-300",
    text: "text-red-800",
    badge: "bg-red-500",
  },
  medium: {
    bg: "bg-orange-100",
    border: "border-orange-300",
    text: "text-orange-800",
    badge: "bg-orange-500",
  },
  low: {
    bg: "bg-yellow-100",
    border: "border-yellow-300",
    text: "text-yellow-800",
    badge: "bg-yellow-500",
  },
} as const

// Category labels for UI
export const CATEGORY_LABELS: Record<DisputeCategory, string> = {
  collections: "Collections",
  chargeoffs: "Charge-offs",
  late_payments: "Late Payments",
  inquiries: "Inquiries",
  personal_info: "Personal Information",
  public_records: "Public Records",
  accounts: "Accounts",
}

// Fields that are important to check for bureau mismatches
const DIFFERENTIAL_CHECK_FIELDS = [
  "Balance", "CurrentBalance", "@_UnpaidBalanceAmount",
  "CreditLimit", "@_CreditLimitAmount", "@_HighCreditAmount",
  "AccountStatus", "@_AccountStatusType", "PaymentStatus",
  "@_30DayLateCount", "@_60DayLateCount", "@_90DayLateCount",
  "MonthlyPayment", "@_MonthlyPaymentAmount",
  "DateOpened", "@_AccountOpenedDate", "DateReported",
] as const

// Normalize value for comparison
function normalizeValueForComparison(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value.trim().toLowerCase()
  return JSON.stringify(value)
}

// Check if values are meaningfully different
function areValuesDifferent(v1: unknown, v2: unknown): boolean {
  const n1 = normalizeValueForComparison(v1)
  const n2 = normalizeValueForComparison(v2)
  if (!n1 && !n2) return false
  if (!n1 || !n2) return true
  const num1 = parseFloat(n1.replace(/[^0-9.-]/g, ""))
  const num2 = parseFloat(n2.replace(/[^0-9.-]/g, ""))
  if (!isNaN(num1) && !isNaN(num2)) {
    const diff = Math.abs(num1 - num2)
    const avg = (Math.abs(num1) + Math.abs(num2)) / 2
    if (avg > 0 && diff / avg < 0.01) return false
    return num1 !== num2
  }
  return n1 !== n2
}

// Get severity for differential based on field type
function getDifferentialSeverity(fieldPath: string): "high" | "medium" | "low" {
  const path = fieldPath.toUpperCase()
  if (path.includes("BALANCE") || path.includes("STATUS") || path.includes("LATE")) return "high"
  if (path.includes("CREDIT") || path.includes("PAYMENT") || path.includes("LIMIT")) return "medium"
  return "low"
}

// Bureau differential detection - flag mismatches between bureaus
export interface BureauDifferential {
  fieldPath: string
  fieldName: string
  values: {
    transunion?: unknown
    experian?: unknown
    equifax?: unknown
  }
  hasMismatch: boolean
  severity: "high" | "medium" | "low"
  reason: string
  accountIdentifier?: string
  creditorName?: string
  sourceAccount?: Record<string, unknown>
}

// Extract bureau differentials from multiple bureau data
export function extractBureauDifferentials(
  tuData: Record<string, unknown> | undefined,
  tuKeys: string[] | undefined,
  exData: Record<string, unknown> | undefined,
  exKeys: string[] | undefined,
  eqData: Record<string, unknown> | undefined,
  eqKeys: string[] | undefined
): BureauDifferential[] {
  const differentials: BureauDifferential[] = []
  
  // Collect all unique keys
  const allKeys = new Set<string>()
  tuKeys?.forEach(k => allKeys.add(k))
  exKeys?.forEach(k => allKeys.add(k))
  eqKeys?.forEach(k => allKeys.add(k))
  
  // Helper to get value at path
  const getValue = (data: Record<string, unknown> | undefined, path: string): unknown => {
    if (!data || !path) return undefined
    const parts = path.replace(/\[\*\]/g, ".0").replace(/\[(\d+)\]/g, ".$1").split(".")
    let current: unknown = data
    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }
    return current
  }
  
  for (const key of allKeys) {
    // Check if this is a field we want to compare for differentials
    const fieldName = key.split(".").pop() || key
    const shouldCheck = DIFFERENTIAL_CHECK_FIELDS.some(f => 
      fieldName.toUpperCase().includes(f.toUpperCase().replace("@_", ""))
    )
    
    if (!shouldCheck) continue
    
    const tuValue = tuData ? getValue(tuData, key) : undefined
    const exValue = exData ? getValue(exData, key) : undefined
    const eqValue = eqData ? getValue(eqData, key) : undefined
    
    // Count how many bureaus have this field
    const hasValues = [tuValue, exValue, eqValue].filter(v => v !== undefined && v !== null && v !== "")
    
    // Need at least 2 bureaus reporting to check for mismatch
    if (hasValues.length < 2) continue
    
    // Check for mismatches
    let hasMismatch = false
    if (tuValue !== undefined && exValue !== undefined && areValuesDifferent(tuValue, exValue)) hasMismatch = true
    if (tuValue !== undefined && eqValue !== undefined && areValuesDifferent(tuValue, eqValue)) hasMismatch = true
    if (exValue !== undefined && eqValue !== undefined && areValuesDifferent(exValue, eqValue)) hasMismatch = true
    
    if (hasMismatch) {
      const severity = getDifferentialSeverity(key)

      let accountIdentifier: string | undefined
      let creditorName: string | undefined
      const liabilityMatch = key.match(/CREDIT_LIABILITY\[(\d+)\]/i)
      let sourceAccount: Record<string, unknown> | undefined
      if (liabilityMatch) {
        const idx = liabilityMatch[1]
        const tryGet = (data: Record<string, unknown> | undefined, path: string) => {
          const v = data ? getValue(data, path) : undefined
          const s = typeof v === "string" ? v.trim() : ""
          return s || undefined
        }

        accountIdentifier =
          tryGet(tuData, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}].@_AccountIdentifier`) ??
          tryGet(exData, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}].@_AccountIdentifier`) ??
          tryGet(eqData, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}].@_AccountIdentifier`)

        creditorName =
          tryGet(tuData, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}]._CREDITOR.@_Name`) ??
          tryGet(exData, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}]._CREDITOR.@_Name`) ??
          tryGet(eqData, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}]._CREDITOR.@_Name`)

        // Get the full source account from whichever bureau has it
        sourceAccount = 
          (tuData ? getValue(tuData, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}]`) : undefined) as Record<string, unknown> | undefined ??
          (exData ? getValue(exData, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}]`) : undefined) as Record<string, unknown> | undefined ??
          (eqData ? getValue(eqData, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}]`) : undefined) as Record<string, unknown> | undefined
      }

      differentials.push({
        fieldPath: key,
        fieldName,
        values: {
          transunion: tuValue,
          experian: exValue,
          equifax: eqValue,
        },
        hasMismatch: true,
        severity,
        reason: `Bureau mismatch: ${fieldName} differs between credit bureaus`,
        accountIdentifier,
        creditorName,
        sourceAccount,
      })
    }
  }
  
  return differentials
}

// Convert bureau differentials to dispute items
export function differentialsToDisputeItems(
  differentials: BureauDifferential[]
): DisputeItem[] {
  return differentials.map((diff, idx) => ({
    id: `differential-${idx}-${diff.fieldPath}`,
    category: "accounts" as DisputeCategory,
    fieldPath: diff.fieldPath,
    fieldName: diff.fieldName,
    value: `TU: ${diff.values.transunion ?? "N/A"} | EX: ${diff.values.experian ?? "N/A"} | EQ: ${diff.values.equifax ?? "N/A"}`,
    bureau: "transunion", // Primary bureau for display
    severity: diff.severity,
    reason: diff.reason,
    accountIdentifier: diff.accountIdentifier,
    creditorName: diff.creditorName,
    sourceAccount: diff.sourceAccount,
  }))
}
