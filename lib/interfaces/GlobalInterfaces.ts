import { AccountCategory } from "../types/Global"

export interface ImportedFile {
  id: string
  name: string
  kind: string
  data: Record<string, unknown>
  keys: string[]
  documentId?: string
  fingerprint?: string
}

export interface BureauAssignment {
  transunion: string | null
  experian: string | null
  equifax: string | null
}

export interface ExtractedAccount {
  id: string;
  category: AccountCategory;
  creditorName: string;
  accountNumber: string;
  fields: Record<string, unknown>;
  sourceKey: string;
  index: number;
  bureau: "transunion" | "experian" | "equifax";
  liabilityIndex?: number;
}