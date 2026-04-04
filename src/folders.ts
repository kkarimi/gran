import type { FolderRecord, FolderSummaryRecord, MeetingSummaryRecord } from "./app/models.ts";
import { renderMeetingList } from "./meetings.ts";
import { toJson, toYaml } from "./render.ts";
import type { GranolaFolder } from "./types.ts";
import { compareStrings } from "./utils.ts";

export type FolderListOutputFormat = "json" | "text" | "yaml";
export type FolderDetailOutputFormat = "json" | "text" | "yaml";

function truncate(value: string, width: number): string {
  if (value.length <= width) {
    return value.padEnd(width);
  }

  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

function compareFolders(left: FolderSummaryRecord, right: FolderSummaryRecord): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    compareStrings(left.name || left.id, right.name || right.id) ||
    compareStrings(left.id, right.id)
  );
}

function matchesFolderSearch(folder: FolderSummaryRecord, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [folder.id, folder.name, folder.description ?? "", folder.workspaceId ?? ""].some(
    (value) => value.toLowerCase().includes(query),
  );
}

function formatFolderDate(value: string): string {
  return value.trim().slice(0, 10) || "-";
}

export function buildFolderSummary(folder: GranolaFolder): FolderSummaryRecord {
  return {
    createdAt: folder.createdAt,
    description: folder.description,
    documentCount: folder.documentIds.length,
    id: folder.id,
    isFavourite: folder.isFavourite,
    name: folder.name,
    updatedAt: folder.updatedAt,
    workspaceId: folder.workspaceId,
  };
}

export function buildFolderRecord(
  folder: GranolaFolder,
  meetings: MeetingSummaryRecord[],
): FolderRecord {
  return {
    ...buildFolderSummary(folder),
    documentIds: [...folder.documentIds],
    meetings: meetings.map((meeting) => ({
      ...meeting,
      folders: meeting.folders.map((candidate) => ({ ...candidate })),
      tags: [...meeting.tags],
    })),
  };
}

export function filterFolders(
  folders: FolderSummaryRecord[],
  options: { limit?: number; search?: string } = {},
): FolderSummaryRecord[] {
  const limit = options.limit ?? 20;

  return folders
    .filter((folder) => (options.search ? matchesFolderSearch(folder, options.search) : true))
    .sort(compareFolders)
    .slice(0, limit)
    .map((folder) => ({ ...folder }));
}

export function resolveFolder(folders: FolderSummaryRecord[], id: string): FolderSummaryRecord {
  const exactMatch = folders.find((folder) => folder.id === id);
  if (exactMatch) {
    return exactMatch;
  }

  const matches = folders.filter((folder) => folder.id.startsWith(id));
  if (matches.length === 1) {
    return matches[0]!;
  }

  if (matches.length > 1) {
    throw new Error(`ambiguous folder id: ${id}`);
  }

  throw new Error(`folder not found: ${id}`);
}

export function resolveFolderQuery(
  folders: FolderSummaryRecord[],
  query: string,
): FolderSummaryRecord {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("folder query is required");
  }

  const lower = trimmed.toLowerCase();
  const exactId = folders.find((folder) => folder.id === trimmed);
  if (exactId) {
    return exactId;
  }

  const exactNameMatches = folders.filter((folder) => folder.name.toLowerCase() === lower);
  if (exactNameMatches.length === 1) {
    return exactNameMatches[0]!;
  }

  const prefixMatches = folders.filter((folder) => folder.id.startsWith(trimmed));
  if (prefixMatches.length === 1) {
    return prefixMatches[0]!;
  }

  const nameMatches = folders
    .filter((folder) => folder.name.toLowerCase().includes(lower))
    .sort(compareFolders);
  if (nameMatches.length === 1) {
    return nameMatches[0]!;
  }

  if (exactNameMatches.length > 1 || prefixMatches.length > 1 || nameMatches.length > 1) {
    throw new Error(`ambiguous folder query: ${trimmed}`);
  }

  throw new Error(`folder not found: ${trimmed}`);
}

export function renderFolderList(
  folders: FolderSummaryRecord[],
  format: FolderListOutputFormat = "text",
): string {
  switch (format) {
    case "json":
      return toJson(folders);
    case "yaml":
      return toYaml(folders);
    case "text":
      break;
  }

  if (folders.length === 0) {
    return "No folders found\n";
  }

  const lines = [
    `${"ID".padEnd(10)} ${"COUNT".padEnd(7)} ${"UPDATED".padEnd(10)} NAME`,
    `${"-".repeat(10)} ${"-".repeat(7)} ${"-".repeat(10)} ${"-".repeat(42)}`,
  ];

  for (const folder of folders) {
    const name = `${folder.isFavourite ? "★ " : ""}${folder.name || folder.id}`;
    lines.push(
      [
        folder.id.slice(0, 8).padEnd(10),
        String(folder.documentCount).padEnd(7),
        formatFolderDate(folder.updatedAt || folder.createdAt).padEnd(10),
        truncate(name, 42),
      ].join(" "),
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderFolderView(
  folder: FolderRecord,
  format: FolderDetailOutputFormat = "text",
): string {
  switch (format) {
    case "json":
      return toJson(folder);
    case "yaml":
      return toYaml(folder);
    case "text":
      break;
  }

  const lines = [
    `# ${folder.name || folder.id}`,
    "",
    `ID: ${folder.id}`,
    `Created: ${folder.createdAt || "-"}`,
    `Updated: ${folder.updatedAt || "-"}`,
    `Documents: ${folder.documentCount}`,
    `Favourite: ${folder.isFavourite ? "yes" : "no"}`,
    `Workspace: ${folder.workspaceId || "-"}`,
  ];

  if (folder.description) {
    lines.push(`Description: ${folder.description}`);
  }

  lines.push("", "## Meetings", "");
  lines.push(renderMeetingList(folder.meetings, "text").trimEnd());
  lines.push("");

  return `${lines.join("\n").trimEnd()}\n`;
}
