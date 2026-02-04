import { getValueAtPath } from "./utils";

export interface CreditScore {
  bureau: "transunion" | "experian" | "equifax";
  score: number;
  date?: string;
  model?: string;
}

export interface CreditMetrics {
  scores: CreditScore[];
  averageScore: number;
  totalAccounts: number;
  openAccounts: number;
  closedAccounts: number;
  negativeAccounts: number;
  collectionsCount: number;
  inquiriesCount: number;
  oldestAccountAge?: string;
  paymentHistoryPercent: number;
  creditUtilization: number;
  totalBalance: number;
  totalCreditLimit: number;
}

function extractScoresFromData(data: unknown): CreditScore[] {
  if (!data || typeof data !== "object") return [];
  
  const scores: CreditScore[] = [];
  
  // Try to find CREDIT_SCORE array
  const creditScores = getValueAtPath(data, "CREDIT_RESPONSE.CREDIT_SCORE");
  
  if (Array.isArray(creditScores)) {
    for (const scoreObj of creditScores) {
      if (!scoreObj || typeof scoreObj !== "object") continue;
      const s = scoreObj as Record<string, unknown>;
      
      const scoreValue = Number(s["@_Value"] ?? s["_Value"] ?? s["value"] ?? 0);
      if (!scoreValue || scoreValue < 300 || scoreValue > 850) continue;
      
      // Determine bureau from source type or file ID
      const sourceType = String(s["@CreditRepositorySourceType"] ?? s["@_SourceType"] ?? "").toLowerCase();
      let bureau: CreditScore["bureau"] = "transunion";
      if (sourceType.includes("experian") || sourceType.includes("exp")) bureau = "experian";
      else if (sourceType.includes("equifax") || sourceType.includes("efx")) bureau = "equifax";
      else if (sourceType.includes("transunion") || sourceType.includes("tui")) bureau = "transunion";
      
      scores.push({
        bureau,
        score: scoreValue,
        date: String(s["@_Date"] ?? s["@CreditScoreDate"] ?? ""),
        model: String(s["@_ModelNameType"] ?? s["@CreditScoreModelNameType"] ?? ""),
      });
    }
  }
  
  return scores;
}

function extractAccountMetrics(data: unknown): {
  total: number;
  open: number;
  closed: number;
  negative: number;
  collections: number;
  totalBalance: number;
  totalLimit: number;
  oldestDate?: string;
} {
  if (!data || typeof data !== "object") {
    return { total: 0, open: 0, closed: 0, negative: 0, collections: 0, totalBalance: 0, totalLimit: 0 };
  }
  
  const liabilities = getValueAtPath(data, "CREDIT_RESPONSE.CREDIT_LIABILITY");
  if (!Array.isArray(liabilities)) {
    return { total: 0, open: 0, closed: 0, negative: 0, collections: 0, totalBalance: 0, totalLimit: 0 };
  }
  
  let open = 0;
  let closed = 0;
  let negative = 0;
  let collections = 0;
  let totalBalance = 0;
  let totalLimit = 0;
  let oldestDate: string | undefined;
  
  for (const acc of liabilities) {
    if (!acc || typeof acc !== "object") continue;
    const a = acc as Record<string, unknown>;
    
    const status = String(a["@_AccountStatusType"] ?? a["accountStatus"] ?? "").toLowerCase();
    const isCollection = String(a["@IsCollectionIndicator"] ?? "").toUpperCase() === "Y";
    const isChargeoff = String(a["@IsChargeoffIndicator"] ?? "").toUpperCase() === "Y";
    const isDerogatory = String(a["@_DerogatoryDataIndicator"] ?? "").toUpperCase() === "Y";
    
    if (status === "open" || status === "active") open++;
    else if (status === "closed" || status === "paid") closed++;
    
    if (isCollection) collections++;
    if (isCollection || isChargeoff || isDerogatory) negative++;
    
    const balance = Number(a["@_UnpaidBalanceAmount"] ?? a["balance"] ?? 0);
    const limit = Number(a["@_CreditLimitAmount"] ?? a["creditLimit"] ?? 0);
    
    if (Number.isFinite(balance) && balance < 999999000) totalBalance += balance;
    if (Number.isFinite(limit) && limit < 999999000) totalLimit += limit;
    
    const openedDate = String(a["@_AccountOpenedDate"] ?? "");
    if (openedDate && (!oldestDate || openedDate < oldestDate)) {
      oldestDate = openedDate;
    }
  }
  
  return {
    total: liabilities.length,
    open,
    closed,
    negative,
    collections,
    totalBalance,
    totalLimit,
    oldestDate,
  };
}

function extractInquiriesCount(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  
  const inquiries = getValueAtPath(data, "CREDIT_RESPONSE.CREDIT_INQUIRY");
  if (Array.isArray(inquiries)) return inquiries.length;
  return 0;
}

function calculateAccountAge(oldestDate?: string): string {
  if (!oldestDate) return "N/A";
  
  try {
    const opened = new Date(oldestDate);
    const now = new Date();
    const years = (now.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    if (years >= 1) {
      return `${years.toFixed(1)} Yrs`;
    }
    const months = Math.floor(years * 12);
    return `${months} Mo`;
  } catch {
    return "N/A";
  }
}

export function extractCreditMetrics(data: unknown): CreditMetrics {
  const scores = extractScoresFromData(data);
  const accountMetrics = extractAccountMetrics(data);
  const inquiriesCount = extractInquiriesCount(data);
  
  const averageScore = scores.length > 0 
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : 0;
  
  const creditUtilization = accountMetrics.totalLimit > 0
    ? Math.round((accountMetrics.totalBalance / accountMetrics.totalLimit) * 100)
    : 0;
  
  // Estimate payment history (simplified - would need actual payment data)
  const paymentHistoryPercent = accountMetrics.negative > 0
    ? Math.max(70, 100 - (accountMetrics.negative * 5))
    : 100;
  
  return {
    scores,
    averageScore,
    totalAccounts: accountMetrics.total,
    openAccounts: accountMetrics.open,
    closedAccounts: accountMetrics.closed,
    negativeAccounts: accountMetrics.negative,
    collectionsCount: accountMetrics.collections,
    inquiriesCount,
    oldestAccountAge: calculateAccountAge(accountMetrics.oldestDate),
    paymentHistoryPercent,
    creditUtilization,
    totalBalance: accountMetrics.totalBalance,
    totalCreditLimit: accountMetrics.totalLimit,
  };
}
