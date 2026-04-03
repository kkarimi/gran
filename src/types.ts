export interface ProseMirrorMark {
  attrs?: Record<string, unknown>;
  type: string;
}

export interface ProseMirrorNode {
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[];
  text?: string;
  type: string;
}

export interface ProseMirrorDoc {
  content?: ProseMirrorNode[];
  type: string;
}

export interface LastViewedPanel {
  affinityNoteId?: string;
  content?: ProseMirrorDoc;
  contentUpdatedAt?: string;
  createdAt?: string;
  deletedAt?: string;
  documentId?: string;
  generatedLines?: unknown[];
  id?: string;
  lastViewedAt?: string;
  originalContent?: string;
  suggestedQuestions?: unknown;
  templateSlug?: string;
  title?: string;
  updatedAt?: string;
}

export interface GranolaDocument {
  content: string;
  createdAt: string;
  id: string;
  lastViewedPanel?: LastViewedPanel;
  notes?: ProseMirrorDoc;
  notesPlain: string;
  tags: string[];
  title: string;
  updatedAt: string;
}

export type NoteContentSource =
  | "notes"
  | "lastViewedPanel.content"
  | "lastViewedPanel.originalContent"
  | "content";

export type NoteOutputFormat = "json" | "markdown" | "raw" | "yaml";

export interface NoteExportRecord {
  content: string;
  contentSource: NoteContentSource;
  createdAt: string;
  id: string;
  raw: GranolaDocument;
  tags: string[];
  title: string;
  updatedAt: string;
}

export interface TranscriptSegment {
  documentId: string;
  endTimestamp: string;
  id: string;
  isFinal: boolean;
  source: string;
  startTimestamp: string;
  text: string;
}

export interface CacheDocument {
  createdAt: string;
  id: string;
  title: string;
  updatedAt: string;
}

export interface CacheData {
  documents: Record<string, CacheDocument>;
  transcripts: Record<string, TranscriptSegment[]>;
}

export type TranscriptOutputFormat = "json" | "raw" | "text" | "yaml";

export interface TranscriptExportSegmentRecord {
  endTimestamp: string;
  id: string;
  isFinal: boolean;
  source: string;
  speaker: string;
  startTimestamp: string;
  text: string;
}

export interface TranscriptExportRecord {
  createdAt: string;
  id: string;
  raw: {
    document: CacheDocument;
    segments: TranscriptSegment[];
  };
  segments: TranscriptExportSegmentRecord[];
  title: string;
  updatedAt: string;
}

export type ExportStateKind = "notes" | "transcripts";

export interface ExportStateEntry {
  contentHash: string;
  exportedAt: string;
  fileName: string;
  fileStem: string;
  sourceUpdatedAt: string;
}

export interface ExportStateFile {
  entries: Record<string, ExportStateEntry>;
  kind: ExportStateKind;
  version: number;
}

export interface NotesOptions {
  output: string;
  timeoutMs: number;
}

export interface TranscriptOptions {
  cacheFile: string;
  output: string;
}

export interface AppConfig {
  configFileUsed?: string;
  debug: boolean;
  notes: NotesOptions;
  supabase?: string;
  transcripts: TranscriptOptions;
}
