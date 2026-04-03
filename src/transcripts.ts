import { join } from "node:path";

import { toJson, toYaml } from "./render.ts";
import type {
  CacheData,
  CacheDocument,
  TranscriptExportRecord,
  TranscriptExportSegmentRecord,
  TranscriptOutputFormat,
  TranscriptSegment,
} from "./types.ts";
import {
  compareStrings,
  ensureDirectory,
  formatTimestampForTranscript,
  makeUniqueFilename,
  sanitiseFilename,
  shouldWriteFile,
  transcriptSpeakerLabel,
  writeTextFile,
} from "./utils.ts";

export function buildTranscriptExport(
  document: CacheDocument,
  segments: TranscriptSegment[],
): TranscriptExportRecord {
  const renderedSegments: TranscriptExportSegmentRecord[] = segments.map((segment) => ({
    endTimestamp: segment.endTimestamp,
    id: segment.id,
    isFinal: segment.isFinal,
    source: segment.source,
    speaker: transcriptSpeakerLabel(segment),
    startTimestamp: segment.startTimestamp,
    text: segment.text,
  }));

  return {
    createdAt: document.createdAt,
    id: document.id,
    raw: {
      document,
      segments,
    },
    segments: renderedSegments,
    title: document.title,
    updatedAt: document.updatedAt,
  };
}

export function renderTranscriptExport(
  transcript: TranscriptExportRecord,
  format: TranscriptOutputFormat = "text",
): string {
  switch (format) {
    case "json":
      return toJson({
        createdAt: transcript.createdAt,
        id: transcript.id,
        segments: transcript.segments,
        title: transcript.title,
        updatedAt: transcript.updatedAt,
      });
    case "raw":
      return toJson(transcript.raw);
    case "yaml":
      return toYaml({
        createdAt: transcript.createdAt,
        id: transcript.id,
        segments: transcript.segments,
        title: transcript.title,
        updatedAt: transcript.updatedAt,
      });
    case "text":
      break;
  }

  return formatTranscriptText(transcript);
}

function formatTranscriptText(transcript: TranscriptExportRecord): string {
  if (transcript.segments.length === 0) {
    return "";
  }

  const header = [
    "=".repeat(80),
    transcript.title || transcript.id,
    `ID: ${transcript.id}`,
    transcript.createdAt ? `Created: ${transcript.createdAt}` : "",
    transcript.updatedAt ? `Updated: ${transcript.updatedAt}` : "",
    `Segments: ${transcript.segments.length}`,
    "=".repeat(80),
    "",
  ].filter(Boolean);

  const body = transcript.segments.map((segment) => {
    const time = formatTimestampForTranscript(segment.startTimestamp);
    return `[${time}] ${segment.speaker}: ${segment.text}`;
  });

  return `${[...header, ...body].join("\n").trimEnd()}\n`;
}

export function formatTranscript(document: CacheDocument, segments: TranscriptSegment[]): string {
  return renderTranscriptExport(buildTranscriptExport(document, segments), "text");
}

function transcriptFilename(document: CacheDocument): string {
  return sanitiseFilename(document.title || document.id, "untitled");
}

function transcriptFileExtension(format: TranscriptOutputFormat): string {
  switch (format) {
    case "json":
      return ".json";
    case "raw":
      return ".raw.json";
    case "text":
      return ".txt";
    case "yaml":
      return ".yaml";
  }
}

export async function writeTranscripts(
  cacheData: CacheData,
  outputDir: string,
  format: TranscriptOutputFormat = "text",
): Promise<number> {
  await ensureDirectory(outputDir);

  const entries = Object.entries(cacheData.transcripts)
    .filter(([, segments]) => segments.length > 0)
    .sort(([leftId], [rightId]) => {
      const leftDocument = cacheData.documents[leftId];
      const rightDocument = cacheData.documents[rightId];
      return (
        compareStrings(leftDocument?.title || leftId, rightDocument?.title || rightId) ||
        compareStrings(leftId, rightId)
      );
    });

  const used = new Map<string, number>();
  let written = 0;

  for (const [documentId, segments] of entries) {
    const document = cacheData.documents[documentId] ?? {
      createdAt: "",
      id: documentId,
      title: documentId,
      updatedAt: "",
    };

    const filename = makeUniqueFilename(transcriptFilename(document), used);
    const filePath = join(outputDir, `${filename}${transcriptFileExtension(format)}`);

    if (!(await shouldWriteFile(filePath, document.updatedAt))) {
      continue;
    }

    const transcript = buildTranscriptExport(document, segments);
    const content = renderTranscriptExport(transcript, format);
    if (!content) {
      continue;
    }

    await writeTextFile(filePath, content);
    written += 1;
  }

  return written;
}
