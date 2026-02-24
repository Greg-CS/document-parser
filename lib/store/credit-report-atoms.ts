import { atom } from "jotai";
import { extractNestedKeys } from "@/lib/utils";
import { splitCombinedCreditReport, normalizeParsedJsonRoot } from "@/lib/credit-report-utils";
import type { ImportedFile, BureauAssignment } from "@/lib/interfaces/GlobalInterfaces";
import type { BureauType } from "@/lib/types/Global";

// ---------------------------------------------------------------------------
// Core writable atoms
// ---------------------------------------------------------------------------

/** Raw CREDIT_RESPONSE wrapper object from Array API, e.g. { CREDIT_RESPONSE: { ... } } */
export const creditReportRawAtom = atom<Record<string, unknown> | null>(null);

/** Whether a fetch is in progress */
export const creditReportLoadingAtom = atom(false);

/** Error message from fetch, if any */
export const creditReportErrorAtom = atom<string | null>(null);

/** Where the report came from */
export const creditReportSourceAtom = atom<"array" | "file" | null>(null);

// ---------------------------------------------------------------------------
// Derived read-only atoms
// ---------------------------------------------------------------------------

/** Parsed ImportedFile[] split by bureau — same pipeline as Dashboard */
export const importedFilesFromArrayAtom = atom<ImportedFile[]>((get) => {
  const raw = get(creditReportRawAtom);
  if (!raw) return [];

  const data = normalizeParsedJsonRoot(raw);
  if (!data) return [];

  const split = splitCombinedCreditReport(data);
  if (!split) {
    // Single-bureau or non-combined report — return as one file
    return [
      {
        id: "array-report",
        name: "Array Credit Report",
        kind: "json",
        data,
        keys: extractNestedKeys(data, "", 10, { arraySampleSize: 25, maxKeys: 5000 }),
      },
    ];
  }

  const bureaus: Array<{ bureau: BureauType; label: string }> = [
    { bureau: "transunion", label: "TransUnion" },
    { bureau: "experian", label: "Experian" },
    { bureau: "equifax", label: "Equifax" },
  ];

  return bureaus.map(({ bureau, label }) => {
    const bureauData = split[bureau];
    return {
      id: `array-report:${bureau}`,
      name: `Array Credit Report (${label})`,
      kind: "json",
      data: bureauData,
      keys: extractNestedKeys(bureauData, "", 10, { arraySampleSize: 25, maxKeys: 5000 }),
    };
  });
});

/** Auto-generated bureau assignments from the Array data */
export const bureauAssignmentsFromArrayAtom = atom<BureauAssignment>((get) => {
  const files = get(importedFilesFromArrayAtom);

  const tu = files.find((f) => f.id.endsWith(":transunion"))?.id ?? files[0]?.id ?? null;
  const ex = files.find((f) => f.id.endsWith(":experian"))?.id ?? files[0]?.id ?? null;
  const eq = files.find((f) => f.id.endsWith(":equifax"))?.id ?? files[0]?.id ?? null;

  return { transunion: tu, experian: ex, equifax: eq };
});

/** Whether Array data is available */
export const hasArrayDataAtom = atom<boolean>((get) => {
  return get(importedFilesFromArrayAtom).length > 0;
});
