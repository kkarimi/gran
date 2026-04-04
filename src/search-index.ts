import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { FolderSummaryRecord, MeetingSummaryRecord } from "./app/models.ts";
import { defaultGranolaToolkitPersistenceLayout } from "./persistence/layout.ts";
import type { CacheData, GranolaDocument } from "./types.ts";
import { parseJsonString } from "./utils.ts";

const SEARCH_INDEX_VERSION = 1;

export interface GranolaSearchIndexEntry {
  createdAt: string;
  folderIds: string[];
  folderNames: string[];
  id: string;
  noteText: string;
  tags: string[];
  title: string;
  transcriptLoaded: boolean;
  transcriptText: string;
  updatedAt: string;
}

interface SearchIndexFile {
  entries: GranolaSearchIndexEntry[];
  updatedAt: string;
  version: number;
}

export interface SearchIndexStore {
  readIndex(): Promise<GranolaSearchIndexEntry[]>;
  writeIndex(entries: GranolaSearchIndexEntry[]): Promise<void>;
}

function cloneEntry(entry: GranolaSearchIndexEntry): GranolaSearchIndexEntry {
  return {
    ...entry,
    folderIds: [...entry.folderIds],
    folderNames: [...entry.folderNames],
    tags: [...entry.tags],
  };
}

function noteText(document: GranolaDocument): string {
  const notes = document.notesPlain.trim();
  if (notes) {
    return notes;
  }

  const panel = document.lastViewedPanel?.originalContent?.trim();
  if (panel) {
    return panel;
  }

  return document.content.trim();
}

function transcriptText(documentId: string, cacheData?: CacheData): string {
  const segments = cacheData?.transcripts[documentId] ?? [];
  return segments
    .filter((segment) => segment.isFinal)
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join("\n");
}

export function buildSearchIndex(
  documents: GranolaDocument[],
  options: {
    cacheData?: CacheData;
    foldersByDocumentId?: Map<string, FolderSummaryRecord[]>;
  } = {},
): GranolaSearchIndexEntry[] {
  return documents
    .map((document) => {
      const folders = options.foldersByDocumentId?.get(document.id) ?? [];
      const transcript = transcriptText(document.id, options.cacheData);
      return {
        createdAt: document.createdAt,
        folderIds: folders.map((folder) => folder.id),
        folderNames: folders.map((folder) => folder.name || folder.id),
        id: document.id,
        noteText: noteText(document),
        tags: [...document.tags],
        title: document.title,
        transcriptLoaded: transcript.length > 0,
        transcriptText: transcript,
        updatedAt: document.updatedAt,
      } satisfies GranolaSearchIndexEntry;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function searchFieldScore(value: string, term: string): number {
  const lower = value.toLowerCase();
  if (!lower || !term) {
    return 0;
  }

  if (lower === term) {
    return 8;
  }

  if (lower.startsWith(term)) {
    return 5;
  }

  if (lower.includes(term)) {
    return 3;
  }

  return 0;
}

function combinedText(entry: GranolaSearchIndexEntry): string {
  return [
    entry.id,
    entry.title,
    ...entry.tags,
    ...entry.folderNames,
    entry.noteText,
    entry.transcriptText,
  ]
    .join("\n")
    .toLowerCase();
}

function searchEntryScore(entry: GranolaSearchIndexEntry, term: string): number | undefined {
  const scoredFields = [
    searchFieldScore(entry.id, term) * 5,
    searchFieldScore(entry.title, term) * 8,
    ...entry.tags.map((tag) => searchFieldScore(tag, term) * 6),
    ...entry.folderNames.map((folderName) => searchFieldScore(folderName, term) * 4),
  ].filter((score) => score > 0);

  if (scoredFields.length > 0) {
    return Math.max(...scoredFields);
  }

  if (combinedText(entry).includes(term)) {
    return 1;
  }

  return undefined;
}

export function searchSearchIndex(
  entries: GranolaSearchIndexEntry[],
  query: string,
): Array<{ id: string; score: number }> {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }

  return entries
    .map((entry) => {
      let score = 0;
      for (const term of terms) {
        const termScore = searchEntryScore(entry, term);
        if (termScore == null) {
          return undefined;
        }

        score += termScore;
      }

      return {
        id: entry.id,
        score,
        updatedAt: entry.updatedAt,
      };
    })
    .filter((entry): entry is { id: string; score: number; updatedAt: string } => Boolean(entry))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.id.localeCompare(right.id),
    )
    .map(({ id, score }) => ({ id, score }));
}

export class MemorySearchIndexStore implements SearchIndexStore {
  #entries: GranolaSearchIndexEntry[] = [];

  async readIndex(): Promise<GranolaSearchIndexEntry[]> {
    return this.#entries.map(cloneEntry);
  }

  async writeIndex(entries: GranolaSearchIndexEntry[]): Promise<void> {
    this.#entries = entries.map(cloneEntry);
  }
}

export class FileSearchIndexStore implements SearchIndexStore {
  constructor(private readonly filePath: string = defaultSearchIndexFilePath()) {}

  async readIndex(): Promise<GranolaSearchIndexEntry[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed = parseJsonString<SearchIndexFile>(contents);
      if (!parsed || parsed.version !== SEARCH_INDEX_VERSION || !Array.isArray(parsed.entries)) {
        return [];
      }

      return parsed.entries.map(cloneEntry);
    } catch {
      return [];
    }
  }

  async writeIndex(entries: GranolaSearchIndexEntry[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload: SearchIndexFile = {
      entries: entries.map(cloneEntry),
      updatedAt: new Date().toISOString(),
      version: SEARCH_INDEX_VERSION,
    };
    await writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}

export function defaultSearchIndexFilePath(): string {
  return defaultGranolaToolkitPersistenceLayout().searchIndexFile;
}

export function createDefaultSearchIndexStore(): SearchIndexStore {
  return new FileSearchIndexStore();
}

export function meetingIdsFromSearchResults(
  results: Array<{ id: string; score: number }>,
): string[] {
  return results.map((result) => result.id);
}

export function filterSearchEntriesByMeetings(
  entries: GranolaSearchIndexEntry[],
  meetings: MeetingSummaryRecord[],
): GranolaSearchIndexEntry[] {
  const ids = new Set(meetings.map((meeting) => meeting.id));
  return entries.filter((entry) => ids.has(entry.id)).map(cloneEntry);
}
