import { join } from "node:path";

import type { CacheData, CacheDocument, TranscriptSegment } from "./types.ts";
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

export function formatTranscript(document: CacheDocument, segments: TranscriptSegment[]): string {
  if (segments.length === 0) {
    return "";
  }

  const header = [
    "=".repeat(80),
    document.title || document.id,
    `ID: ${document.id}`,
    document.createdAt ? `Created: ${document.createdAt}` : "",
    document.updatedAt ? `Updated: ${document.updatedAt}` : "",
    `Segments: ${segments.length}`,
    "=".repeat(80),
    "",
  ].filter(Boolean);

  const body = segments.map((segment) => {
    const time = formatTimestampForTranscript(segment.startTimestamp);
    return `[${time}] ${transcriptSpeakerLabel(segment)}: ${segment.text}`;
  });

  return `${[...header, ...body].join("\n").trimEnd()}\n`;
}

function transcriptFilename(document: CacheDocument): string {
  return sanitiseFilename(document.title || document.id, "untitled");
}

export async function writeTranscripts(cacheData: CacheData, outputDir: string): Promise<number> {
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
    const filePath = join(outputDir, `${filename}.txt`);

    if (!(await shouldWriteFile(filePath, document.updatedAt))) {
      continue;
    }

    const content = formatTranscript(document, segments);
    if (!content) {
      continue;
    }

    await writeTextFile(filePath, content);
    written += 1;
  }

  return written;
}
