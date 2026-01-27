/**
 * Computes a fingerprint for a credit report based on stable identifying fields.
 * Used to detect "similar" uploads for the same consumer/accounts.
 */

function normalizeString(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path
    .replace(/\[\*\]/g, ".0")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Paths to extract stable identifying info from parsed credit report data
const FINGERPRINT_PATHS = [
  // Personal info
  "BORROWER.BORROWER_DETAIL.Name.FirstName",
  "BORROWER.BORROWER_DETAIL.Name.LastName",
  "BORROWER.BORROWER_DETAIL.CONTACT_DETAIL.CONTACT_POINT.ContactPointTelephoneValue",
  "BORROWER.SSN.SSNIdentifier",
  // Common alt paths
  "firstName",
  "lastName",
  "ssn",
  "ssnLast4",
];

// Account identifying paths (iterate over CREDIT_LIABILITY array)
const ACCOUNT_PATHS = [
  "CreditLiabilityAccountIdentifier",
  "CreditLiabilityCreditorName",
  "CreditLiabilityAccountType",
];

function extractAccounts(data: unknown): string[] {
  const accounts: string[] = [];
  const liabilities = getValueAtPath(data, "CREDIT_LIABILITY") as unknown[];
  if (!Array.isArray(liabilities)) return accounts;

  for (const liability of liabilities.slice(0, 20)) {
    // limit to first 20 accounts
    const parts: string[] = [];
    for (const path of ACCOUNT_PATHS) {
      const val = getValueAtPath(liability, path);
      if (typeof val === "string" && val.trim()) {
        parts.push(normalizeString(val));
      }
    }
    if (parts.length > 0) {
      accounts.push(parts.join("|"));
    }
  }
  return accounts.sort();
}

export function computeReportFingerprint(parsedData: unknown): string {
  const parts: string[] = [];

  // Extract personal info
  for (const path of FINGERPRINT_PATHS) {
    const val = getValueAtPath(parsedData, path);
    if (typeof val === "string" && val.trim()) {
      parts.push(`${path}=${normalizeString(val)}`);
    }
  }

  // Extract account identifiers
  const accounts = extractAccounts(parsedData);
  if (accounts.length > 0) {
    parts.push(`accounts=${accounts.join(",")}`);
  }

  // Create a simple hash from the concatenated parts
  const content = parts.join(";");
  if (!content) return "";

  // Simple hash (for matching purposes, not cryptographic)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}
