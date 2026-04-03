import type { CacheData, CacheDocument, TranscriptSegment } from "./types.ts";
import { asRecord, parseJsonString, stringValue } from "./utils.ts";

function parseCacheDocument(id: string, value: unknown): CacheDocument | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  return {
    createdAt: stringValue(record.created_at),
    id,
    title: stringValue(record.title),
    updatedAt: stringValue(record.updated_at),
  };
}

function parseTranscriptSegments(value: unknown): TranscriptSegment[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((segment) => {
    const record = asRecord(segment);
    if (!record) {
      return [];
    }

    return [
      {
        documentId: stringValue(record.document_id),
        endTimestamp: stringValue(record.end_timestamp),
        id: stringValue(record.id),
        isFinal: Boolean(record.is_final),
        source: stringValue(record.source),
        startTimestamp: stringValue(record.start_timestamp),
        text: stringValue(record.text),
      },
    ];
  });
}

export function parseCacheContents(contents: string): CacheData {
  const outer = parseJsonString<Record<string, unknown>>(contents);
  if (!outer) {
    throw new Error("failed to parse cache JSON");
  }

  const rawCache = outer.cache;
  let cachePayload: Record<string, unknown> | undefined;

  if (typeof rawCache === "string") {
    cachePayload = parseJsonString<Record<string, unknown>>(rawCache);
  } else {
    cachePayload = asRecord(rawCache);
  }

  const state = cachePayload ? asRecord(cachePayload.state) : undefined;
  if (!state) {
    throw new Error("failed to parse cache state");
  }

  const rawDocuments = asRecord(state.documents) ?? {};
  const rawTranscripts = asRecord(state.transcripts) ?? {};

  const documents: Record<string, CacheDocument> = {};
  for (const [id, rawDocument] of Object.entries(rawDocuments)) {
    const document = parseCacheDocument(id, rawDocument);
    if (document) {
      documents[id] = document;
    }
  }

  const transcripts: Record<string, TranscriptSegment[]> = {};
  for (const [id, rawTranscript] of Object.entries(rawTranscripts)) {
    const segments = parseTranscriptSegments(rawTranscript);
    if (segments) {
      transcripts[id] = segments;
    }
  }

  return { documents, transcripts };
}
