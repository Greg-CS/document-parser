export type SupportedKind = "json" | "csv" | "html" | "pdf";

export type PreviewMode = "labels" | "raw" | "table" | "mapping" | "report";

export type FileItem = {
  id: string;
  file: File;
  kind: SupportedKind;
  addedAt: number;
};

export type JsonParseState =
  | {
      status: "idle";
      fileId: string | null;
    }
  | {
      status: "loading";
      fileId: string;
    }
  | {
      status: "error";
      fileId: string;
      message: string;
    }
  | {
      status: "success";
      fileId: string;
      value: unknown;
      pretty: string;
    };

export type HtmlParsed = {
  title: string;
  metaDescription: string;
  headings: Array<{ level: "h1" | "h2" | "h3"; text: string }>;
  links: Array<{ text: string; href: string }>;
  images: number;
  textPreview: string;
  raw: string;
};

export type HtmlParseState =
  | {
      status: "idle";
      fileId: string | null;
    }
  | {
      status: "loading";
      fileId: string;
    }
  | {
      status: "error";
      fileId: string;
      message: string;
    }
  | {
      status: "success";
      fileId: string;
      value: HtmlParsed;
    };

export type CanonicalFieldDto = {
  id: string;
  name: string;
  dataType: string;
  description: string | null;
};

export type FieldMappingDraft = Record<string, string>;

export type SavedUploadedDocumentReport = {
  id: string;
  createdAt: string | Date;
  sourceType: string;
};

export type SavedUploadedDocument = {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string | Date;
  sourceType: string;
  parsedData: unknown;
  reports: SavedUploadedDocumentReport[];
  reportFingerprint?: string | null;
};
