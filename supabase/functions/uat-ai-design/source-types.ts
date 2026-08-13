export type SourceReadStatus =
  | "ready"
  | "authorization_required"
  | "permission_denied"
  | "unsupported"
  | "failed";

export interface NormalizedSourceDocument {
  title: string;
  plainText: string;
  structuredBlocks: Array<{ type: string; text?: string; inferred?: boolean }>;
  imageObservations: Array<{ alt: string; inferred: boolean }>;
  contentSha256: string;
  counts: {
    characterCount: number;
    tableCount: number;
    imageCount: number;
    attachmentCount: number;
  };
}

export type SourceReadResult =
  | { status: "ready"; document: NormalizedSourceDocument }
  | {
    status: Exclude<SourceReadStatus, "ready">;
    errorCode: string;
    errorMessage: string;
  };
