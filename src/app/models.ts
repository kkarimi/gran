import type { CacheDocument, GranolaDocument, TranscriptSegment } from "../types.ts";

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

export interface FolderSummaryRecord {
  createdAt: string;
  description?: string;
  documentCount: number;
  id: string;
  isFavourite: boolean;
  name: string;
  updatedAt: string;
  workspaceId?: string;
}

export interface MeetingSummaryRecord {
  createdAt: string;
  folders: FolderSummaryRecord[];
  id: string;
  noteContentSource: NoteContentSource;
  tags: string[];
  title: string;
  transcriptLoaded: boolean;
  transcriptSegmentCount: number;
  updatedAt: string;
}

export type MeetingSummarySource = "index" | "live";

export interface MeetingNoteRecord {
  content: string;
  contentSource: NoteContentSource;
  createdAt: string;
  id: string;
  tags: string[];
  title: string;
  updatedAt: string;
}

export interface MeetingTranscriptRecord {
  createdAt: string;
  id: string;
  segments: TranscriptExportSegmentRecord[];
  title: string;
  updatedAt: string;
}

export interface MeetingRecord {
  meeting: MeetingSummaryRecord;
  note: MeetingNoteRecord;
  noteMarkdown: string;
  transcript: MeetingTranscriptRecord | null;
  transcriptText: string | null;
}

export interface FolderRecord extends FolderSummaryRecord {
  documentIds: string[];
  meetings: MeetingSummaryRecord[];
}

export type GranolaSessionMode = "api-key" | "stored-session" | "supabase-file";

export interface GranolaSessionMetadata {
  apiKeyAvailable?: boolean;
  clientId?: string;
  lastError?: string;
  mode: GranolaSessionMode;
  refreshAvailable: boolean;
  signInMethod?: string;
  storedSessionAvailable: boolean;
  supabaseAvailable: boolean;
  supabasePath?: string;
}
