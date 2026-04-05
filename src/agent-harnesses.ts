import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  GranolaAutomationMatch,
  GranolaMeetingBundle,
  GranolaSyncEventKind,
} from "./app/index.ts";
import { defaultGranolaToolkitPersistenceLayout } from "./persistence/layout.ts";
import type { GranolaAgentProviderKind } from "./types.ts";
import { parseJsonString } from "./utils.ts";

export interface GranolaAgentHarnessMatch {
  calendarEventIds?: string[];
  eventKinds?: GranolaSyncEventKind[];
  folderIds?: string[];
  folderNames?: string[];
  meetingIds?: string[];
  recurringEventIds?: string[];
  tags?: string[];
  titleIncludes?: string[];
  titleMatches?: string;
  transcriptLoaded?: boolean;
}

export interface GranolaAgentHarness {
  cwd?: string;
  fallbackHarnessIds?: string[];
  id: string;
  match?: GranolaAgentHarnessMatch;
  model?: string;
  name: string;
  priority?: number;
  prompt?: string;
  promptFile?: string;
  provider?: GranolaAgentProviderKind;
  systemPrompt?: string;
  systemPromptFile?: string;
}

export interface GranolaAgentHarnessContext {
  bundle?: GranolaMeetingBundle;
  match: GranolaAutomationMatch;
}

export interface GranolaAgentHarnessMatchExplanation {
  harness: GranolaAgentHarness;
  matched: boolean;
  reasons: string[];
  specificity: number;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  return values.length > 0 ? [...new Set(values)] : undefined;
}

function parseMatch(value: unknown): GranolaAgentHarnessMatch | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return {
    calendarEventIds: stringArray(record.calendarEventIds),
    eventKinds: stringArray(record.eventKinds) as GranolaSyncEventKind[] | undefined,
    folderIds: stringArray(record.folderIds),
    folderNames: stringArray(record.folderNames),
    meetingIds: stringArray(record.meetingIds),
    recurringEventIds: stringArray(record.recurringEventIds),
    tags: stringArray(record.tags),
    titleIncludes: stringArray(record.titleIncludes),
    titleMatches:
      typeof record.titleMatches === "string" && record.titleMatches.trim()
        ? record.titleMatches.trim()
        : undefined,
    transcriptLoaded:
      typeof record.transcriptLoaded === "boolean" ? record.transcriptLoaded : undefined,
  };
}

function parseHarness(value: unknown): GranolaAgentHarness | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : undefined;
  const name =
    typeof record.name === "string" && record.name.trim() ? record.name.trim() : undefined;
  if (!id || !name) {
    return undefined;
  }

  const provider =
    record.provider === "codex" || record.provider === "openai" || record.provider === "openrouter"
      ? record.provider
      : undefined;
  const prompt =
    typeof record.prompt === "string" && record.prompt.trim() ? record.prompt.trim() : undefined;
  const promptFile =
    typeof record.promptFile === "string" && record.promptFile.trim()
      ? record.promptFile.trim()
      : undefined;
  if (!prompt && !promptFile) {
    return undefined;
  }

  return {
    cwd: typeof record.cwd === "string" && record.cwd.trim() ? record.cwd.trim() : undefined,
    fallbackHarnessIds: stringArray(record.fallbackHarnessIds),
    id,
    match: parseMatch(record.match),
    model:
      typeof record.model === "string" && record.model.trim() ? record.model.trim() : undefined,
    name,
    priority:
      typeof record.priority === "number" && Number.isFinite(record.priority)
        ? record.priority
        : typeof record.priority === "string" && /^-?\d+$/.test(record.priority)
          ? Number(record.priority)
          : undefined,
    prompt,
    promptFile,
    provider,
    systemPrompt:
      typeof record.systemPrompt === "string" && record.systemPrompt.trim()
        ? record.systemPrompt.trim()
        : undefined,
    systemPromptFile:
      typeof record.systemPromptFile === "string" && record.systemPromptFile.trim()
        ? record.systemPromptFile.trim()
        : undefined,
  };
}

function cloneHarness(harness: GranolaAgentHarness): GranolaAgentHarness {
  return {
    ...harness,
    fallbackHarnessIds: harness.fallbackHarnessIds ? [...harness.fallbackHarnessIds] : undefined,
    match: harness.match
      ? {
          ...harness.match,
          calendarEventIds: harness.match.calendarEventIds
            ? [...harness.match.calendarEventIds]
            : undefined,
          eventKinds: harness.match.eventKinds ? [...harness.match.eventKinds] : undefined,
          folderIds: harness.match.folderIds ? [...harness.match.folderIds] : undefined,
          folderNames: harness.match.folderNames ? [...harness.match.folderNames] : undefined,
          meetingIds: harness.match.meetingIds ? [...harness.match.meetingIds] : undefined,
          recurringEventIds: harness.match.recurringEventIds
            ? [...harness.match.recurringEventIds]
            : undefined,
          tags: harness.match.tags ? [...harness.match.tags] : undefined,
          titleIncludes: harness.match.titleIncludes ? [...harness.match.titleIncludes] : undefined,
        }
      : undefined,
  };
}

function includesIgnoreCase(candidate: string, values: string[]): boolean {
  const lowerCandidate = candidate.toLowerCase();
  return values.some((value) => lowerCandidate.includes(value.toLowerCase()));
}

function harnessSpecificity(match?: GranolaAgentHarnessMatch): number {
  if (!match) {
    return 0;
  }

  return [
    match.calendarEventIds?.length ?? 0,
    match.eventKinds?.length ?? 0,
    match.folderIds?.length ?? 0,
    match.folderNames?.length ?? 0,
    match.meetingIds?.length ?? 0,
    match.recurringEventIds?.length ?? 0,
    match.tags?.length ?? 0,
    match.titleIncludes?.length ?? 0,
    match.titleMatches ? 1 : 0,
    match.transcriptLoaded != null ? 1 : 0,
  ].reduce((total, count) => total + count, 0);
}

function addReason(
  reasons: string[],
  condition: boolean,
  successMessage: string,
  failureMessage: string,
): boolean {
  reasons.push(condition ? successMessage : failureMessage);
  return condition;
}

function matchesHarness(
  harness: GranolaAgentHarness,
  context: GranolaAgentHarnessContext,
): boolean {
  const match = harness.match;
  if (!match) {
    return true;
  }

  if (match.eventKinds?.length && !match.eventKinds.includes(context.match.eventKind)) {
    return false;
  }

  if (match.meetingIds?.length && !match.meetingIds.includes(context.match.meetingId)) {
    return false;
  }

  if (
    match.folderIds?.length &&
    !context.match.folders.some((folder) => match.folderIds?.includes(folder.id))
  ) {
    return false;
  }

  if (
    match.folderNames?.length &&
    !context.match.folders.some((folder) => match.folderNames?.includes(folder.name))
  ) {
    return false;
  }

  if (match.tags?.length && !context.match.tags.some((tag) => match.tags?.includes(tag))) {
    return false;
  }

  if (match.transcriptLoaded != null && context.match.transcriptLoaded !== match.transcriptLoaded) {
    return false;
  }

  if (
    match.titleIncludes?.length &&
    !includesIgnoreCase(context.match.title, match.titleIncludes)
  ) {
    return false;
  }

  if (match.titleMatches) {
    try {
      const pattern = new RegExp(match.titleMatches, "i");
      if (!pattern.test(context.match.title)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const calendarEventId = context.bundle?.document.calendarEvent?.id;
  if (match.calendarEventIds?.length && !calendarEventId) {
    return false;
  }
  if (match.calendarEventIds?.length && !match.calendarEventIds.includes(calendarEventId!)) {
    return false;
  }

  const recurringEventId = context.bundle?.document.calendarEvent?.recurringEventId;
  if (match.recurringEventIds?.length && !recurringEventId) {
    return false;
  }
  if (match.recurringEventIds?.length && !match.recurringEventIds.includes(recurringEventId!)) {
    return false;
  }

  return true;
}

export function explainAgentHarnessMatch(
  harness: GranolaAgentHarness,
  context: GranolaAgentHarnessContext,
): GranolaAgentHarnessMatchExplanation {
  const clonedHarness = cloneHarness(harness);
  const match = clonedHarness.match;
  const reasons: string[] = [];

  if (!match) {
    return {
      harness: clonedHarness,
      matched: true,
      reasons: ["No match rules configured, so this harness applies to any meeting."],
      specificity: 0,
    };
  }

  let matched = true;

  if (match.eventKinds?.length) {
    matched =
      addReason(
        reasons,
        match.eventKinds.includes(context.match.eventKind),
        `Event kind ${context.match.eventKind} matched ${match.eventKinds.join(", ")}.`,
        `Event kind ${context.match.eventKind} did not match ${match.eventKinds.join(", ")}.`,
      ) && matched;
  }

  if (match.meetingIds?.length) {
    matched =
      addReason(
        reasons,
        match.meetingIds.includes(context.match.meetingId),
        `Meeting id ${context.match.meetingId} matched.`,
        `Meeting id ${context.match.meetingId} did not match ${match.meetingIds.join(", ")}.`,
      ) && matched;
  }

  if (match.folderIds?.length) {
    const matchedFolderIds = context.match.folders
      .filter((folder) => match.folderIds?.includes(folder.id))
      .map((folder) => folder.id);
    matched =
      addReason(
        reasons,
        matchedFolderIds.length > 0,
        `Folder id matched ${matchedFolderIds.join(", ")}.`,
        `Folder ids ${match.folderIds.join(", ")} did not match this meeting.`,
      ) && matched;
  }

  if (match.folderNames?.length) {
    const matchedFolderNames = context.match.folders
      .filter((folder) => match.folderNames?.includes(folder.name))
      .map((folder) => folder.name);
    matched =
      addReason(
        reasons,
        matchedFolderNames.length > 0,
        `Folder name matched ${matchedFolderNames.join(", ")}.`,
        `Folder names ${match.folderNames.join(", ")} did not match this meeting.`,
      ) && matched;
  }

  if (match.tags?.length) {
    const matchedTags = context.match.tags.filter((tag) => match.tags?.includes(tag));
    matched =
      addReason(
        reasons,
        matchedTags.length > 0,
        `Tags matched ${matchedTags.join(", ")}.`,
        `Tags ${match.tags.join(", ")} did not match this meeting.`,
      ) && matched;
  }

  if (match.transcriptLoaded != null) {
    matched =
      addReason(
        reasons,
        context.match.transcriptLoaded === match.transcriptLoaded,
        `Transcript loaded matched ${String(match.transcriptLoaded)}.`,
        `Transcript loaded was ${String(context.match.transcriptLoaded)}, expected ${String(match.transcriptLoaded)}.`,
      ) && matched;
  }

  if (match.titleIncludes?.length) {
    matched =
      addReason(
        reasons,
        includesIgnoreCase(context.match.title, match.titleIncludes),
        `Title matched includes rule ${match.titleIncludes.join(", ")}.`,
        `Title "${context.match.title}" did not include ${match.titleIncludes.join(", ")}.`,
      ) && matched;
  }

  if (match.titleMatches) {
    try {
      const pattern = new RegExp(match.titleMatches, "i");
      matched =
        addReason(
          reasons,
          pattern.test(context.match.title),
          `Title matched /${match.titleMatches}/i.`,
          `Title "${context.match.title}" did not match /${match.titleMatches}/i.`,
        ) && matched;
    } catch {
      matched =
        addReason(reasons, false, "", `Title regex /${match.titleMatches}/i is invalid.`) &&
        matched;
    }
  }

  const calendarEventId = context.bundle?.document.calendarEvent?.id;
  if (match.calendarEventIds?.length) {
    matched =
      addReason(
        reasons,
        Boolean(calendarEventId && match.calendarEventIds.includes(calendarEventId)),
        `Calendar event matched ${calendarEventId}.`,
        calendarEventId
          ? `Calendar event ${calendarEventId} did not match ${match.calendarEventIds.join(", ")}.`
          : `Meeting does not have a calendar event id, expected ${match.calendarEventIds.join(", ")}.`,
      ) && matched;
  }

  const recurringEventId = context.bundle?.document.calendarEvent?.recurringEventId;
  if (match.recurringEventIds?.length) {
    matched =
      addReason(
        reasons,
        Boolean(recurringEventId && match.recurringEventIds.includes(recurringEventId)),
        `Recurring event matched ${recurringEventId}.`,
        recurringEventId
          ? `Recurring event ${recurringEventId} did not match ${match.recurringEventIds.join(", ")}.`
          : `Meeting does not have a recurring event id, expected ${match.recurringEventIds.join(", ")}.`,
      ) && matched;
  }

  if (reasons.length === 0) {
    reasons.push("Matched all configured harness rules.");
  }

  return {
    harness: clonedHarness,
    matched,
    reasons,
    specificity: harnessSpecificity(clonedHarness.match),
  };
}

export function explainAgentHarnesses(
  harnesses: GranolaAgentHarness[],
  context: GranolaAgentHarnessContext,
): GranolaAgentHarnessMatchExplanation[] {
  return harnesses
    .map((harness) => explainAgentHarnessMatch(harness, context))
    .sort((left, right) => {
      if (left.matched !== right.matched) {
        return left.matched ? -1 : 1;
      }

      const priority = (right.harness.priority ?? 0) - (left.harness.priority ?? 0);
      if (priority !== 0) {
        return priority;
      }

      return right.specificity - left.specificity;
    });
}

export function normaliseAgentHarnesses(harnesses: GranolaAgentHarness[]): GranolaAgentHarness[] {
  const normalised = harnesses.map((harness, index) => {
    const parsed = parseHarness(harness);
    if (!parsed) {
      throw new Error(`invalid agent harness at index ${index + 1}`);
    }

    if (parsed.match?.titleMatches) {
      try {
        new RegExp(parsed.match.titleMatches, "i");
      } catch (error) {
        throw new Error(
          `invalid titleMatches regex for harness ${parsed.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return parsed;
  });

  const ids = new Set<string>();
  for (const harness of normalised) {
    if (ids.has(harness.id)) {
      throw new Error(`duplicate agent harness id: ${harness.id}`);
    }

    ids.add(harness.id);
  }

  for (const harness of normalised) {
    for (const fallbackHarnessId of harness.fallbackHarnessIds ?? []) {
      if (!ids.has(fallbackHarnessId)) {
        throw new Error(
          `fallback harness ${fallbackHarnessId} referenced by ${harness.id} was not found`,
        );
      }
    }
  }

  return normalised.map(cloneHarness);
}

export function matchAgentHarnesses(
  harnesses: GranolaAgentHarness[],
  context: GranolaAgentHarnessContext,
): GranolaAgentHarness[] {
  return harnesses
    .filter((harness) => matchesHarness(harness, context))
    .slice()
    .sort((left, right) => {
      const priority = (right.priority ?? 0) - (left.priority ?? 0);
      if (priority !== 0) {
        return priority;
      }

      return harnessSpecificity(right.match) - harnessSpecificity(left.match);
    })
    .map(cloneHarness);
}

export function resolveAgentHarness(
  harnesses: GranolaAgentHarness[],
  context: GranolaAgentHarnessContext,
  harnessId?: string,
): GranolaAgentHarness | undefined {
  if (harnessId?.trim()) {
    const harness = harnesses.find((candidate) => candidate.id === harnessId.trim());
    if (!harness) {
      throw new Error(`agent harness not found: ${harnessId.trim()}`);
    }

    return cloneHarness(harness);
  }

  const matches = matchAgentHarnesses(harnesses, context);
  return matches[0];
}

export interface AgentHarnessStore {
  readHarnesses(): Promise<GranolaAgentHarness[]>;
  writeHarnesses(harnesses: GranolaAgentHarness[]): Promise<void>;
}

export class MemoryAgentHarnessStore implements AgentHarnessStore {
  constructor(private harnesses: GranolaAgentHarness[] = []) {}

  async readHarnesses(): Promise<GranolaAgentHarness[]> {
    return this.harnesses.map(cloneHarness);
  }

  async writeHarnesses(harnesses: GranolaAgentHarness[]): Promise<void> {
    this.harnesses = normaliseAgentHarnesses(harnesses);
  }
}

export class FileAgentHarnessStore implements AgentHarnessStore {
  constructor(private readonly filePath: string = defaultAgentHarnessesFilePath()) {}

  async readHarnesses(): Promise<GranolaAgentHarness[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed = parseJsonString<unknown>(contents);
      const rawHarnesses = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { harnesses?: unknown[] }).harnesses)
          ? (parsed as { harnesses: unknown[] }).harnesses
          : [];

      return rawHarnesses
        .map((harness) => parseHarness(harness))
        .filter((harness): harness is GranolaAgentHarness => Boolean(harness))
        .map(cloneHarness);
    } catch {
      return [];
    }
  }

  async writeHarnesses(harnesses: GranolaAgentHarness[]): Promise<void> {
    const normalised = normaliseAgentHarnesses(harnesses);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      `${JSON.stringify({ harnesses: normalised }, null, 2)}\n`,
      "utf8",
    );
  }
}

export function defaultAgentHarnessesFilePath(): string {
  return defaultGranolaToolkitPersistenceLayout().agentHarnessesFile;
}

export function createDefaultAgentHarnessStore(filePath?: string): AgentHarnessStore {
  return new FileAgentHarnessStore(filePath);
}
