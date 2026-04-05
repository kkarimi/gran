import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  GranolaAutomationAction,
  GranolaAutomationAgentAction,
  GranolaAutomationCommandAction,
  GranolaAutomationExportNotesAction,
  GranolaAutomationExportTranscriptAction,
  GranolaAutomationPipelineConfig,
  GranolaAutomationPkmSyncAction,
  GranolaAutomationSlackMessageAction,
  GranolaAutomationMatch,
  GranolaAutomationRule,
  GranolaAutomationWebhookAction,
  GranolaAutomationWriteFileAction,
  GranolaAppSyncEvent,
} from "./app/index.ts";
import { defaultGranolaToolkitPersistenceLayout } from "./persistence/layout.ts";
import { asRecord, parseJsonString, stringValue } from "./utils.ts";

function cloneRule(rule: GranolaAutomationRule): GranolaAutomationRule {
  return {
    ...rule,
    actions: rule.actions?.map((action) => cloneAction(action)),
    when: {
      ...rule.when,
      eventKinds: rule.when.eventKinds ? [...rule.when.eventKinds] : undefined,
      folderIds: rule.when.folderIds ? [...rule.when.folderIds] : undefined,
      folderNames: rule.when.folderNames ? [...rule.when.folderNames] : undefined,
      meetingIds: rule.when.meetingIds ? [...rule.when.meetingIds] : undefined,
      tags: rule.when.tags ? [...rule.when.tags] : undefined,
      titleIncludes: rule.when.titleIncludes ? [...rule.when.titleIncludes] : undefined,
    },
  };
}

function cloneAction(action: GranolaAutomationAction): GranolaAutomationAction {
  switch (action.kind) {
    case "agent":
      return {
        ...action,
        approvalMode: action.approvalMode,
        fallbackHarnessIds: action.fallbackHarnessIds ? [...action.fallbackHarnessIds] : undefined,
        pipeline: action.pipeline ? { ...action.pipeline } : undefined,
      };
    case "ask-user":
      return { ...action };
    case "command":
      return {
        ...action,
        args: action.args ? [...action.args] : undefined,
        env: action.env ? { ...action.env } : undefined,
      };
    case "export-notes":
    case "export-transcript":
      return { ...action };
    case "pkm-sync":
      return { ...action };
    case "slack-message":
      return { ...action };
    case "webhook":
      return {
        ...action,
        headers: action.headers ? { ...action.headers } : undefined,
      };
    case "write-file":
      return { ...action };
  }
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return values.length > 0 ? [...new Set(values.map((item) => item.trim()))] : undefined;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(([key, item]) => {
    return (
      typeof key === "string" &&
      key.trim().length > 0 &&
      typeof item === "string" &&
      item.trim().length > 0
    );
  }) as Array<[string, string]>;
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries.map(([key, item]) => [key.trim(), item.trim()]));
}

function parsePipeline(value: unknown): GranolaAutomationPipelineConfig | undefined {
  const record = asRecord(value);
  const kind = record
    ? stringValue(record.kind).trim()
    : typeof value === "string"
      ? value.trim()
      : "";
  return kind === "enrichment" || kind === "notes" ? { kind } : undefined;
}

function parseTrigger(value: unknown): "approval" | "match" | undefined {
  if (value === "approval" || value === "match") {
    return value;
  }

  return undefined;
}

function parseAction(value: unknown, index: number): GranolaAutomationAction | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const kind =
    typeof record.kind === "string" && record.kind.trim() ? record.kind.trim() : undefined;
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : kind
        ? `${kind}-${index + 1}`
        : undefined;
  const name =
    typeof record.name === "string" && record.name.trim() ? record.name.trim() : undefined;
  const enabled = typeof record.enabled === "boolean" ? record.enabled : undefined;

  switch (kind) {
    case "agent": {
      if (!id) {
        return undefined;
      }

      const provider =
        record.provider === "codex" ||
        record.provider === "openai" ||
        record.provider === "openrouter"
          ? record.provider
          : undefined;
      const prompt =
        typeof record.prompt === "string" && record.prompt.trim()
          ? record.prompt.trim()
          : undefined;
      const promptFile =
        typeof record.promptFile === "string" && record.promptFile.trim()
          ? record.promptFile.trim()
          : undefined;
      const harnessId =
        typeof record.harnessId === "string" && record.harnessId.trim()
          ? record.harnessId.trim()
          : undefined;
      const fallbackHarnessIds = stringArray(record.fallbackHarnessIds);
      const systemPrompt =
        typeof record.systemPrompt === "string" && record.systemPrompt.trim()
          ? record.systemPrompt.trim()
          : undefined;
      const systemPromptFile =
        typeof record.systemPromptFile === "string" && record.systemPromptFile.trim()
          ? record.systemPromptFile.trim()
          : undefined;
      if (!prompt && !promptFile && !harnessId) {
        return undefined;
      }

      const action: GranolaAutomationAgentAction = {
        approvalMode:
          record.approvalMode === "auto" || record.approvalMode === "manual"
            ? record.approvalMode
            : undefined,
        cwd: typeof record.cwd === "string" && record.cwd.trim() ? record.cwd.trim() : undefined,
        dryRun: typeof record.dryRun === "boolean" ? record.dryRun : undefined,
        enabled,
        fallbackHarnessIds,
        harnessId,
        id,
        kind,
        model:
          typeof record.model === "string" && record.model.trim() ? record.model.trim() : undefined,
        name,
        pipeline: parsePipeline(record.pipeline),
        prompt,
        promptFile,
        provider,
        retries:
          typeof record.retries === "number" && Number.isFinite(record.retries)
            ? record.retries
            : typeof record.retries === "string" && /^\d+$/.test(record.retries)
              ? Number(record.retries)
              : undefined,
        systemPrompt,
        systemPromptFile,
        timeoutMs:
          typeof record.timeoutMs === "number" && Number.isFinite(record.timeoutMs)
            ? record.timeoutMs
            : typeof record.timeoutMs === "string" && /^\d+$/.test(record.timeoutMs)
              ? Number(record.timeoutMs)
              : undefined,
      };
      return action;
    }
    case "ask-user": {
      const prompt =
        typeof record.prompt === "string" && record.prompt.trim()
          ? record.prompt.trim()
          : undefined;
      if (!id || !prompt) {
        return undefined;
      }

      return {
        details:
          typeof record.details === "string" && record.details.trim()
            ? record.details.trim()
            : undefined,
        enabled,
        id,
        kind,
        name,
        prompt,
      };
    }
    case "command": {
      const command =
        typeof record.command === "string" && record.command.trim()
          ? record.command.trim()
          : undefined;
      if (!id || !command) {
        return undefined;
      }

      const action: GranolaAutomationCommandAction = {
        args: stringArray(record.args),
        command,
        cwd: typeof record.cwd === "string" && record.cwd.trim() ? record.cwd.trim() : undefined,
        enabled,
        env: stringRecord(record.env),
        id,
        kind,
        name,
        sourceActionId:
          typeof record.sourceActionId === "string" && record.sourceActionId.trim()
            ? record.sourceActionId.trim()
            : undefined,
        stdin: record.stdin === "json" || record.stdin === "none" ? record.stdin : undefined,
        timeoutMs:
          typeof record.timeoutMs === "number" && Number.isFinite(record.timeoutMs)
            ? record.timeoutMs
            : typeof record.timeoutMs === "string" && /^\d+$/.test(record.timeoutMs)
              ? Number(record.timeoutMs)
              : undefined,
        trigger: parseTrigger(record.trigger),
      };
      return action;
    }
    case "export-notes": {
      if (!id) {
        return undefined;
      }

      const format =
        record.format === "json" ||
        record.format === "markdown" ||
        record.format === "raw" ||
        record.format === "yaml"
          ? record.format
          : undefined;

      const action: GranolaAutomationExportNotesAction = {
        enabled,
        format,
        id,
        kind,
        name,
        outputDir:
          typeof record.outputDir === "string" && record.outputDir.trim()
            ? record.outputDir.trim()
            : undefined,
        scopedOutput: typeof record.scopedOutput === "boolean" ? record.scopedOutput : undefined,
      };
      return action;
    }
    case "export-transcript": {
      if (!id) {
        return undefined;
      }

      const format =
        record.format === "json" ||
        record.format === "raw" ||
        record.format === "text" ||
        record.format === "yaml"
          ? record.format
          : undefined;

      const action: GranolaAutomationExportTranscriptAction = {
        enabled,
        format,
        id,
        kind,
        name,
        outputDir:
          typeof record.outputDir === "string" && record.outputDir.trim()
            ? record.outputDir.trim()
            : undefined,
        scopedOutput: typeof record.scopedOutput === "boolean" ? record.scopedOutput : undefined,
      };
      return action;
    }
    case "pkm-sync": {
      const targetId =
        typeof record.targetId === "string" && record.targetId.trim()
          ? record.targetId.trim()
          : undefined;
      if (!id || !targetId) {
        return undefined;
      }

      const action: GranolaAutomationPkmSyncAction = {
        enabled,
        id,
        kind,
        name,
        sourceActionId:
          typeof record.sourceActionId === "string" && record.sourceActionId.trim()
            ? record.sourceActionId.trim()
            : undefined,
        targetId,
        trigger: parseTrigger(record.trigger),
      };
      return action;
    }
    case "slack-message": {
      if (!id) {
        return undefined;
      }

      const action: GranolaAutomationSlackMessageAction = {
        enabled,
        id,
        kind,
        name,
        sourceActionId:
          typeof record.sourceActionId === "string" && record.sourceActionId.trim()
            ? record.sourceActionId.trim()
            : undefined,
        text:
          typeof record.text === "string" && record.text.trim() ? record.text.trim() : undefined,
        trigger: parseTrigger(record.trigger),
        webhookUrl:
          typeof record.webhookUrl === "string" && record.webhookUrl.trim()
            ? record.webhookUrl.trim()
            : undefined,
        webhookUrlEnv:
          typeof record.webhookUrlEnv === "string" && record.webhookUrlEnv.trim()
            ? record.webhookUrlEnv.trim()
            : undefined,
      };
      return action;
    }
    case "webhook": {
      if (!id) {
        return undefined;
      }

      const action: GranolaAutomationWebhookAction = {
        bodyTemplate:
          typeof record.bodyTemplate === "string" && record.bodyTemplate.trim()
            ? record.bodyTemplate.trim()
            : undefined,
        enabled,
        headers: stringRecord(record.headers),
        id,
        kind,
        method:
          typeof record.method === "string" && record.method.trim()
            ? record.method.trim().toUpperCase()
            : undefined,
        name,
        payload:
          record.payload === "json" || record.payload === "markdown" || record.payload === "text"
            ? record.payload
            : undefined,
        sourceActionId:
          typeof record.sourceActionId === "string" && record.sourceActionId.trim()
            ? record.sourceActionId.trim()
            : undefined,
        trigger: parseTrigger(record.trigger),
        url: typeof record.url === "string" && record.url.trim() ? record.url.trim() : undefined,
        urlEnv:
          typeof record.urlEnv === "string" && record.urlEnv.trim()
            ? record.urlEnv.trim()
            : undefined,
      };
      return action;
    }
    case "write-file": {
      const outputDir =
        typeof record.outputDir === "string" && record.outputDir.trim()
          ? record.outputDir.trim()
          : undefined;
      if (!id || !outputDir) {
        return undefined;
      }

      const action: GranolaAutomationWriteFileAction = {
        contentTemplate:
          typeof record.contentTemplate === "string" && record.contentTemplate.trim()
            ? record.contentTemplate.trim()
            : undefined,
        enabled,
        filenameTemplate:
          typeof record.filenameTemplate === "string" && record.filenameTemplate.trim()
            ? record.filenameTemplate.trim()
            : undefined,
        format:
          record.format === "json" || record.format === "markdown" || record.format === "text"
            ? record.format
            : undefined,
        id,
        kind,
        name,
        outputDir,
        overwrite: typeof record.overwrite === "boolean" ? record.overwrite : undefined,
        sourceActionId:
          typeof record.sourceActionId === "string" && record.sourceActionId.trim()
            ? record.sourceActionId.trim()
            : undefined,
        trigger: parseTrigger(record.trigger),
      };
      return action;
    }
    default:
      return undefined;
  }
}

function parseRule(value: unknown): GranolaAutomationRule | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : undefined;
  const name =
    typeof record.name === "string" && record.name.trim() ? record.name.trim() : undefined;
  const whenValue =
    record.when && typeof record.when === "object" && !Array.isArray(record.when)
      ? (record.when as Record<string, unknown>)
      : undefined;

  if (!id || !name || !whenValue) {
    return undefined;
  }

  return {
    actions: Array.isArray(record.actions)
      ? record.actions
          .map((action, index) => parseAction(action, index))
          .filter((action): action is GranolaAutomationAction => Boolean(action))
      : undefined,
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    id,
    name,
    when: {
      eventKinds: stringArray(whenValue.eventKinds) as GranolaAutomationRule["when"]["eventKinds"],
      folderIds: stringArray(whenValue.folderIds),
      folderNames: stringArray(whenValue.folderNames),
      meetingIds: stringArray(whenValue.meetingIds),
      tags: stringArray(whenValue.tags),
      titleIncludes: stringArray(whenValue.titleIncludes),
      titleMatches:
        typeof whenValue.titleMatches === "string" && whenValue.titleMatches.trim()
          ? whenValue.titleMatches.trim()
          : undefined,
      transcriptLoaded:
        typeof whenValue.transcriptLoaded === "boolean" ? whenValue.transcriptLoaded : undefined,
    },
  };
}

export interface AutomationRuleStore {
  readRules(): Promise<GranolaAutomationRule[]>;
  writeRules(rules: GranolaAutomationRule[]): Promise<void>;
}

export class MemoryAutomationRuleStore implements AutomationRuleStore {
  constructor(private readonly rules: GranolaAutomationRule[] = []) {}

  async readRules(): Promise<GranolaAutomationRule[]> {
    return this.rules.map(cloneRule);
  }

  async writeRules(rules: GranolaAutomationRule[]): Promise<void> {
    this.rules.splice(0, this.rules.length, ...rules.map(cloneRule));
  }
}

export class FileAutomationRuleStore implements AutomationRuleStore {
  constructor(private readonly filePath: string = defaultAutomationRulesFilePath()) {}

  async readRules(): Promise<GranolaAutomationRule[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed = parseJsonString<unknown>(contents);
      const rawRules = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { rules?: unknown[] }).rules)
          ? (parsed as { rules: unknown[] }).rules
          : [];

      return rawRules
        .map((rule) => parseRule(rule))
        .filter((rule): rule is GranolaAutomationRule => Boolean(rule))
        .map(cloneRule);
    } catch {
      return [];
    }
  }

  async writeRules(rules: GranolaAutomationRule[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify({ rules }, null, 2)}\n`, "utf8");
  }
}

export function defaultAutomationRulesFilePath(): string {
  return defaultGranolaToolkitPersistenceLayout().automationRulesFile;
}

function includesIgnoreCase(candidate: string, values: string[]): boolean {
  const lowerCandidate = candidate.toLowerCase();
  return values.some((value) => lowerCandidate.includes(value.toLowerCase()));
}

function matchesRule(rule: GranolaAutomationRule, event: GranolaAppSyncEvent): boolean {
  if (rule.enabled === false) {
    return false;
  }

  const { when } = rule;

  if (when.eventKinds?.length && !when.eventKinds.includes(event.kind)) {
    return false;
  }

  if (when.meetingIds?.length && !when.meetingIds.includes(event.meetingId)) {
    return false;
  }

  if (
    when.folderIds?.length &&
    !event.folders.some((folder) => when.folderIds?.includes(folder.id))
  ) {
    return false;
  }

  if (
    when.folderNames?.length &&
    !event.folders.some((folder) => when.folderNames?.includes(folder.name))
  ) {
    return false;
  }

  if (when.tags?.length && !event.tags.some((tag) => when.tags?.includes(tag))) {
    return false;
  }

  if (when.titleIncludes?.length && !includesIgnoreCase(event.title, when.titleIncludes)) {
    return false;
  }

  if (when.titleMatches) {
    try {
      const pattern = new RegExp(when.titleMatches, "i");
      if (!pattern.test(event.title)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  if (
    typeof when.transcriptLoaded === "boolean" &&
    when.transcriptLoaded !== event.transcriptLoaded
  ) {
    return false;
  }

  return true;
}

export function matchAutomationRules(
  rules: GranolaAutomationRule[],
  events: GranolaAppSyncEvent[],
  matchedAt: string,
): GranolaAutomationMatch[] {
  const matches: GranolaAutomationMatch[] = [];

  for (const event of events) {
    for (const rule of rules) {
      if (!matchesRule(rule, event)) {
        continue;
      }

      matches.push({
        eventId: event.id,
        eventKind: event.kind,
        folders: event.folders.map((folder) => ({ ...folder })),
        id: `${event.id}:${rule.id}`,
        matchedAt,
        meetingId: event.meetingId,
        ruleId: rule.id,
        ruleName: rule.name,
        tags: [...event.tags],
        title: event.title,
        transcriptLoaded: event.transcriptLoaded,
      });
    }
  }

  return matches;
}

export function createDefaultAutomationRuleStore(filePath?: string): AutomationRuleStore {
  return new FileAutomationRuleStore(filePath);
}
