import { type BureauType } from "@/lib/types/Global";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function bureauMatchesSourceType(sourceType: unknown, bureau: BureauType): boolean {
  if (typeof sourceType !== "string") return false;
  const normalized = sourceType.toLowerCase();
  if (bureau === "equifax") return normalized.includes("equifax") || normalized === "efx";
  if (bureau === "experian") return normalized.includes("experian") || normalized === "exp";
  return normalized.includes("transunion") || normalized === "tu";
}

export function bureauMatchesCreditFileId(creditFileId: unknown, bureau: BureauType): boolean {
  if (typeof creditFileId !== "string") return false;
  const id = creditFileId.toUpperCase();
  if (bureau === "equifax") return /\bEA\d*\b/.test(id);
  if (bureau === "experian") return /\bRA\d*\b/.test(id);
  return /\bTA\d*\b/.test(id);
}

export function isBureauSpecificObject(value: unknown, bureau: BureauType): boolean {
  if (!isRecord(value)) return false;

  const sourceType = value["@_SourceType"] ?? value["@SourceType"];
  if (bureauMatchesSourceType(sourceType, bureau)) return true;

  const creditFileId = value["@CreditFileID"];
  if (bureauMatchesCreditFileId(creditFileId, bureau)) return true;

  const creditRepository = value["CREDIT_REPOSITORY"];
  if (Array.isArray(creditRepository)) {
    return creditRepository.some((r) => isBureauSpecificObject(r, bureau));
  }
  if (isRecord(creditRepository)) {
    return isBureauSpecificObject(creditRepository, bureau);
  }

  return false;
}

export function shouldKeepKeyForBureau(key: string, bureau: BureauType): boolean {
  const upper = key.toUpperCase();
  const mentionsEquifax = upper.includes("EQUIFAX") || upper.endsWith("_EFX") || upper.endsWith("_EQ");
  const mentionsExperian = upper.includes("EXPERIAN") || upper.endsWith("_EXP") || upper.endsWith("_EX");
  const mentionsTransunion = upper.includes("TRANSUNION") || upper.endsWith("_TU") || upper.endsWith("_TRU");

  if (mentionsEquifax || mentionsExperian || mentionsTransunion) {
    if (bureau === "equifax") return mentionsEquifax;
    if (bureau === "experian") return mentionsExperian;
    return mentionsTransunion;
  }

  return true;
}

export function filterForBureau(value: unknown, bureau: BureauType, depth = 0): unknown {
  if (depth > 8) return value;
  if (Array.isArray(value)) {
    const filtered = value.filter((item) => {
      if (!isRecord(item)) return true;
      const hasMarker =
        typeof item["@CreditFileID"] === "string" ||
        typeof item["@_SourceType"] === "string" ||
        typeof item["@SourceType"] === "string" ||
        item["CREDIT_REPOSITORY"] !== undefined;
      if (!hasMarker) return true;
      return isBureauSpecificObject(item, bureau);
    });
    return filtered.map((item) => filterForBureau(item, bureau, depth + 1));
  }
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (depth <= 1 && !shouldKeepKeyForBureau(k, bureau)) continue;
    next[k] = filterForBureau(v, bureau, depth + 1);
  }
  return next;
}

export function splitCombinedCreditReport(data: Record<string, unknown>): Record<BureauType, Record<string, unknown>> | null {
  const cr = data["CREDIT_RESPONSE"];
  if (!isRecord(cr)) return null;

  const included = cr["CREDIT_REPOSITORY_INCLUDED"];
  const likelyCombined =
    isRecord(included) &&
    Object.values(included).some((v) => String(v).toUpperCase() === "Y") &&
    (Array.isArray(cr["CREDIT_LIABILITY"]) || Array.isArray(cr["CREDIT_INQUIRY"]) || Array.isArray(cr["CREDIT_FILE"])) ;

  if (!likelyCombined) return null;

  const result: Record<BureauType, Record<string, unknown>> = {
    transunion: { ...data, CREDIT_RESPONSE: filterForBureau(cr, "transunion", 0) as Record<string, unknown> },
    experian: { ...data, CREDIT_RESPONSE: filterForBureau(cr, "experian", 0) as Record<string, unknown> },
    equifax: { ...data, CREDIT_RESPONSE: filterForBureau(cr, "equifax", 0) as Record<string, unknown> },
  };

  return result;
}

export function normalizeParsedJsonRoot(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return isRecord(first) ? (first as Record<string, unknown>) : null;
  }
  return isRecord(value) ? (value as Record<string, unknown>) : null;
}
