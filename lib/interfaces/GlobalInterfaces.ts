export interface ImportedFile {
  id: string
  name: string
  kind: string
  data: Record<string, unknown>
  keys: string[]
}

export interface BureauAssignment {
  transunion: string | null
  experian: string | null
  equifax: string | null
}