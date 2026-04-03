import { join } from "node:path";

import { toJson, toYaml } from "./render.ts";
import type {
  GranolaDocument,
  NoteContentSource,
  NoteExportRecord,
  NoteOutputFormat,
} from "./types.ts";
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

function selectNoteContent(document: GranolaDocument): {
  content: string;
  source: NoteContentSource;
} {
  const notes = convertProseMirrorToMarkdown(document.notes).trim();
  if (notes) {
    return { content: notes, source: "notes" };
  }

  const lastViewedPanel = convertProseMirrorToMarkdown(document.lastViewedPanel?.content).trim();
  if (lastViewedPanel) {
    return { content: lastViewedPanel, source: "lastViewedPanel.content" };
  }

  const originalContent = htmlToMarkdownFallback(
    document.lastViewedPanel?.originalContent ?? "",
  ).trim();
  if (originalContent) {
    return { content: originalContent, source: "lastViewedPanel.originalContent" };
  }

  return { content: document.content.trim(), source: "content" };
}

export function buildNoteExport(document: GranolaDocument): NoteExportRecord {
  const { content, source } = selectNoteContent(document);
  return {
    content,
    contentSource: source,
    createdAt: document.createdAt,
    id: document.id,
    raw: document,
    tags: document.tags,
    title: document.title,
    updatedAt: document.updatedAt,
  };
}

export function renderNoteExport(
  note: NoteExportRecord,
  format: NoteOutputFormat = "markdown",
): string {
  switch (format) {
    case "json":
      return toJson({
        content: note.content,
        contentSource: note.contentSource,
        createdAt: note.createdAt,
        id: note.id,
        tags: note.tags,
        title: note.title,
        updatedAt: note.updatedAt,
      });
    case "raw":
      return toJson(note.raw);
    case "yaml":
      return toYaml({
        content: note.content,
        contentSource: note.contentSource,
        createdAt: note.createdAt,
        id: note.id,
        tags: note.tags,
        title: note.title,
        updatedAt: note.updatedAt,
      });
    case "markdown":
      break;
  }

  const lines: string[] = [
    "---",
    `id: ${quoteYamlString(note.id)}`,
    `created: ${quoteYamlString(note.createdAt)}`,
    `updated: ${quoteYamlString(note.updatedAt)}`,
  ];

  if (note.tags.length > 0) {
    lines.push("tags:");
    for (const tag of note.tags) {
      lines.push(`  - ${quoteYamlString(tag)}`);
    }
  }

  lines.push("---", "");

  if (note.title.trim()) {
    lines.push(`# ${note.title.trim()}`, "");
  }

  if (note.content) {
    lines.push(note.content);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function documentToMarkdown(document: GranolaDocument): string {
  return renderNoteExport(buildNoteExport(document), "markdown");
}

function documentFilename(document: GranolaDocument): string {
  return sanitiseFilename(document.title || document.id, "untitled");
}

function noteFileExtension(format: NoteOutputFormat): string {
  switch (format) {
    case "json":
      return ".json";
    case "raw":
      return ".raw.json";
    case "yaml":
      return ".yaml";
    case "markdown":
      return ".md";
  }
}

export async function writeNotes(
  documents: GranolaDocument[],
  outputDir: string,
  format: NoteOutputFormat = "markdown",
): Promise<number> {
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
    const filePath = join(outputDir, `${filename}${noteFileExtension(format)}`);

    if (!(await shouldWriteFile(filePath, latestDocumentTimestamp(document)))) {
      continue;
    }

    const note = buildNoteExport(document);
    await writeTextFile(filePath, renderNoteExport(note, format));
    written += 1;
  }

  return written;
}
