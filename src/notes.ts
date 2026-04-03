import { join } from "node:path";

import type { GranolaDocument } from "./types.ts";
import { convertProseMirrorToMarkdown } from "./prosemirror.ts";
import {
  compareStrings,
  ensureDirectory,
  htmlToMarkdownFallback,
  latestDocumentTimestamp,
  makeUniqueFilename,
  quoteYamlString,
  sanitiseFilename,
  shouldWriteFile,
  writeTextFile,
} from "./utils.ts";

export function documentToMarkdown(document: GranolaDocument): string {
  const lines: string[] = [
    "---",
    `id: ${quoteYamlString(document.id)}`,
    `created: ${quoteYamlString(document.createdAt)}`,
    `updated: ${quoteYamlString(document.updatedAt)}`,
  ];

  if (document.tags.length > 0) {
    lines.push("tags:");
    for (const tag of document.tags) {
      lines.push(`  - ${quoteYamlString(tag)}`);
    }
  }

  lines.push("---", "");

  if (document.title.trim()) {
    lines.push(`# ${document.title.trim()}`, "");
  }

  const content =
    convertProseMirrorToMarkdown(document.notes).trim() ||
    convertProseMirrorToMarkdown(document.lastViewedPanel?.content).trim() ||
    htmlToMarkdownFallback(document.lastViewedPanel?.originalContent ?? "").trim() ||
    document.content.trim();

  if (content) {
    lines.push(content);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function documentFilename(document: GranolaDocument): string {
  return sanitiseFilename(document.title || document.id, "untitled");
}

export async function writeNotes(documents: GranolaDocument[], outputDir: string): Promise<number> {
  await ensureDirectory(outputDir);

  const sorted = [...documents].sort(
    (left, right) =>
      compareStrings(left.title || left.id, right.title || right.id) ||
      compareStrings(left.id, right.id),
  );

  const used = new Map<string, number>();
  let written = 0;

  for (const document of sorted) {
    const filename = makeUniqueFilename(documentFilename(document), used);
    const filePath = join(outputDir, `${filename}.md`);

    if (!(await shouldWriteFile(filePath, latestDocumentTimestamp(document)))) {
      continue;
    }

    await writeTextFile(filePath, documentToMarkdown(document));
    written += 1;
  }

  return written;
}
