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
  
  // Adverse ratings
  "@_HIGHEST_ADVERSE_RATING",
  "@_MOST_RECENT_ADVERSE_RATING",
  "@_CURRENT_RATING",
  
  // Charge-off data
  "@_ChargeOffAmount",
  "@_ChargeOffDate",
  "@_PastDueAmount",
  "@_FirstDelinquencyDate",
  
  // Account status issues
  "@_AccountStatusType",
  "@RawAccountStatus",
] as const

// Field patterns that are always considered negative when present with non-zero/non-empty values
export const NEGATIVE_VALUE_PATTERNS: Record<string, (value: unknown) => boolean> = {
  // Boolean indicators - true means negative
  "IsCollectionIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  "IsChargeoffIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  "DerogatoryDataIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  "ConsumerDisputeIndicator": (v) => v === true || v === "Y" || v === "Yes" || v === "1" || v === 1,
  
  // Numeric fields - non-zero means negative
  "_30Days": (v) => typeof v === "number" ? v > 0 : parseInt(String(v), 10) > 0,
  "_60Days": (v) => typeof v === "number" ? v > 0 : parseInt(String(v), 10) > 0,
  "_90Days": (v) => typeof v === "number" ? v > 0 : parseInt(String(v), 10) > 0,
  "ChargeOffAmount": (v) => typeof v === "number" ? v > 0 : parseFloat(String(v)) > 0,
  "PastDueAmount": (v) => typeof v === "number" ? v > 0 : parseFloat(String(v)) > 0,
  
  // Rating codes - certain codes indicate negative
  "_Code": (v) => {
    const negativeRatingCodes = ["2", "3", "4", "5", "6", "7", "8", "9", "CA", "CO", "FC", "BK"]
    return negativeRatingCodes.includes(String(v).toUpperCase())
  },
  
  // Account status - certain statuses are negative
  "AccountStatusType": (v) => {
    const negativeStatuses = [
      "Chargeoff", "Collection", "Delinquent", "Late", "PastDue",
      "Repossession", "Foreclosure", "Bankruptcy", "Closed"
    ]
    const val = String(v).toLowerCase()
    return negativeStatuses.some(s => val.includes(s.toLowerCase()))
  },
}

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
  
  if (path.includes("LATE_COUNT") || path.includes("DELINQUENCY") || path.includes("ADVERSE")) {
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
  
  if (path.includes("PUBLIC_RECORD") || path.includes("BANKRUPTCY")) {
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
    path.includes("_90DAYS")
  ) {
    return "high"
  }
  
  // Medium severity
  if (
    path.includes("_60DAYS") ||
    path.includes("DEROGATORY") ||
    path.includes("ADVERSE") ||
    path.includes("PASTDUE")
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
      return checker(value)
    }
  }
  
  // For dates in delinquency/chargeoff contexts, presence indicates negative
  if (
    (fieldPath.includes("Delinquency") || fieldPath.includes("ChargeOff")) &&
    fieldPath.includes("Date") &&
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
    const value = getValueAtPath(data, key)
    
    if (isNegativeValue(key, value)) {
      const category = getFieldCategory(key)
      const severity = getDisputeSeverity(key, value)
      
      // Try to extract account identifier and creditor name from context
      let accountIdentifier: string | undefined
      let creditorName: string | undefined
      
      if (key.includes("CREDIT_LIABILITY")) {
        const match = key.match(/CREDIT_LIABILITY\[(\d+)\]/)
        if (match) {
          const idx = match[1]
          accountIdentifier = getValueAtPath(data, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}].@_AccountIdentifier`) as string
          creditorName = getValueAtPath(data, `CREDIT_RESPONSE.CREDIT_LIABILITY[${idx}]._CREDITOR.@_Name`) as string
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
      })
    }
  }
  
  return items
}

// Generate a human-readable dispute reason
function generateDisputeReason(fieldPath: string, value: unknown): string {
  const path = fieldPath.toUpperCase()
  
  if (path.includes("COLLECTION")) {
    return "Account reported as collection"
  }
  if (path.includes("CHARGEOFF")) {
    return "Account charged off"
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
  if (path.includes("PASTDUE")) {
    return `Past due amount: $${value}`
  }
  if (path.includes("DEROGATORY")) {
    return "Derogatory data reported"
  }
  if (path.includes("ADVERSE")) {
    return "Adverse rating on account"
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
