import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";

import { automationActionName, type AutomationActionContext } from "../automation-actions.ts";
import {
  buildAutomationDeliveryPayload,
  renderSlackMessageText,
  renderWebhookBody,
  renderWriteFileContent,
  resolveWriteFilePath,
} from "../automation-delivery.ts";
import { meetingExportScope, resolveExportOutputDir } from "../export-scope.ts";
import { buildPipelineInstructions } from "../processing.ts";
import { scopedCacheDataForMeeting } from "./meeting-read-model.ts";
import type {
  GranolaAutomationAgentAction,
  GranolaAutomationActionRun,
  GranolaAutomationArtefact,
  GranolaAutomationCommandAction,
  GranolaAutomationExportNotesAction,
  GranolaAutomationExportTranscriptAction,
  GranolaAutomationMatch,
  GranolaAutomationPkmSyncAction,
  GranolaAutomationRule,
  GranolaAutomationSlackMessageAction,
  GranolaAutomationWebhookAction,
  GranolaAutomationWriteFileAction,
  GranolaMeetingBundle,
  GranolaAppState,
  GranolaExportScope,
  GranolaExportTarget,
} from "./types.ts";
import type { AppConfig, CacheData, NoteOutputFormat, TranscriptOutputFormat } from "../types.ts";
import { writeTextFile } from "../utils.ts";
import type { GranolaAgentHarness } from "../agent-harnesses.ts";
import type { GranolaAutomationAgentRequest } from "../agents.ts";

interface ResolvedAutomationAgentAttempt {
  harness?: GranolaAgentHarness;
  prompt: string;
  request: GranolaAutomationAgentRequest;
  systemPrompt?: string;
}

interface GranolaAutomationRuntimeDependencies {
  config: Pick<AppConfig, "notes" | "transcripts">;
  maybeReadMeetingBundleById: (
    id: string,
    options?: { requireCache?: boolean },
  ) => Promise<GranolaMeetingBundle | undefined>;
  nowIso: () => string;
  readMeetingBundleById: (
    id: string,
    options?: { requireCache?: boolean },
  ) => Promise<GranolaMeetingBundle>;
  state: Pick<GranolaAppState, "auth">;
  runNotesExport: (options: {
    documents: Array<GranolaMeetingBundle["source"]["document"]>;
    format: NoteOutputFormat;
    outputDir: string;
    scopedOutput?: boolean;
    scope: GranolaExportScope;
    target?: GranolaExportTarget;
    trackLastRun?: boolean;
    updateUi?: boolean;
  }) => Promise<{
    format: string;
    outputDir: string;
    scope: GranolaExportScope;
    written: number;
  }>;
  runPkmSync: (
    meetingId: string,
    action: GranolaAutomationPkmSyncAction,
    artefact: GranolaAutomationArtefact,
  ) => Promise<{
    dailyNoteFilePath?: string;
    dailyNoteOpenUrl?: string;
    filePath: string;
    noteOpenUrl?: string;
    targetId: string;
    transcriptFilePath?: string;
    transcriptOpenUrl?: string;
  }>;
  runTranscriptsExport: (options: {
    cacheData: CacheData;
    documentContexts?: Map<string, GranolaMeetingBundle["source"]["document"]>;
    format: TranscriptOutputFormat;
    outputDir: string;
    scopedOutput?: boolean;
    scope: GranolaExportScope;
    target?: GranolaExportTarget;
    trackLastRun?: boolean;
    updateUi?: boolean;
  }) => Promise<{
    format: string;
    outputDir: string;
    scope: GranolaExportScope;
    written: number;
  }>;
}

function resolveActionFilePath(filePath: string, cwd?: string): string {
  return cwd ? resolvePath(cwd, filePath) : resolvePath(filePath);
}

async function readOptionalActionFile(
  filePath?: string,
  cwd?: string,
): Promise<string | undefined> {
  if (!filePath) {
    return undefined;
  }

  return await readFile(resolveActionFilePath(filePath, cwd), "utf8");
}

function combinePromptSections(...values: Array<string | undefined>): string | undefined {
  const sections = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return sections.length > 0 ? sections.join("\n\n") : undefined;
}

function meetingTranscriptText(bundle: GranolaMeetingBundle): string | undefined {
  const segments = bundle.meeting.transcript?.segments;
  if (!segments?.length) {
    return undefined;
  }

  return segments
    .slice()
    .sort((left, right) => left.startTimestamp.localeCompare(right.startTimestamp))
    .map((segment) => `${segment.speaker}: ${segment.text.trim()}`)
    .filter(Boolean)
    .join("\n");
}

function buildAutomationAgentPrompt(
  match: GranolaAutomationMatch,
  rule: GranolaAutomationRule,
  instructions: string,
  bundle?: GranolaMeetingBundle,
): string {
  const transcriptText = bundle ? meetingTranscriptText(bundle)?.trim() : undefined;
  const document = bundle?.source.document;
  const context = {
    event: {
      id: match.eventId,
      kind: match.eventKind,
      matchedAt: match.matchedAt,
      meetingId: match.meetingId,
      transcriptLoaded: match.transcriptLoaded,
    },
    folders: match.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
    })),
    meeting: bundle
      ? {
          id: document!.id,
          notesPlain: document!.notesPlain,
          roleHelpers: bundle.meeting.roleHelpers,
          tags: [...document!.tags],
          title: document!.title,
          updatedAt: document!.updatedAt,
        }
      : {
          id: match.meetingId,
          tags: [...match.tags],
          title: match.title,
        },
    rule: {
      id: rule.id,
      name: rule.name,
    },
  };

  return [
    instructions.trim(),
    "Meeting context (JSON):",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
    document?.notesPlain?.trim() ? `Existing notes:\n${document.notesPlain.trim()}` : "",
    transcriptText ? `Transcript:\n${transcriptText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export class GranolaAutomationRuntime {
  constructor(private readonly deps: GranolaAutomationRuntimeDependencies) {}

  handlers() {
    return {
      exportNotes: async (
        match: GranolaAutomationMatch,
        action: GranolaAutomationExportNotesAction,
      ) => await this.runAutomationNotesAction(match, action),
      exportTranscripts: async (
        match: GranolaAutomationMatch,
        action: GranolaAutomationExportTranscriptAction,
      ) => await this.runAutomationTranscriptAction(match, action),
      nowIso: () => this.deps.nowIso(),
      prepareAgentAttempt: async (
        match: GranolaAutomationMatch,
        rule: GranolaAutomationRule,
        action: GranolaAutomationAgentAction,
        bundle: GranolaMeetingBundle | undefined,
        harness: GranolaAgentHarness | undefined,
      ): Promise<ResolvedAutomationAgentAttempt> =>
        await this.buildAutomationAgentAttempt(match, rule, action, bundle, harness),
      runCommand: async (
        match: GranolaAutomationMatch,
        rule: GranolaAutomationRule,
        action: GranolaAutomationCommandAction,
        context: AutomationActionContext,
      ) => await this.runAutomationCommand(match, rule, action, context),
      runPkmSync: async (
        match: GranolaAutomationMatch,
        rule: GranolaAutomationRule,
        action: GranolaAutomationPkmSyncAction,
        context: AutomationActionContext,
      ) => await this.runAutomationPkmSync(match, rule, action, context),
      runSlackMessage: async (
        match: GranolaAutomationMatch,
        rule: GranolaAutomationRule,
        action: GranolaAutomationSlackMessageAction,
        context: AutomationActionContext,
      ) => await this.runAutomationSlackMessage(match, rule, action, context),
      runWebhook: async (
        match: GranolaAutomationMatch,
        rule: GranolaAutomationRule,
        action: GranolaAutomationWebhookAction,
        context: AutomationActionContext,
      ) => await this.runAutomationWebhook(match, rule, action, context),
      writeFile: async (
        match: GranolaAutomationMatch,
        rule: GranolaAutomationRule,
        action: GranolaAutomationWriteFileAction,
        context: AutomationActionContext,
      ) => await this.runAutomationWriteFile(match, rule, action, context),
    };
  }

  private async runAutomationNotesAction(
    match: GranolaAutomationMatch,
    action: GranolaAutomationExportNotesAction,
  ): Promise<
    | {
        format: string;
        outputDir: string;
        scope: GranolaExportScope;
        written: number;
      }
    | undefined
  > {
    const bundle = await this.deps.maybeReadMeetingBundleById(match.meetingId);
    if (!bundle) {
      return undefined;
    }

    const scope = meetingExportScope({
      meetingId: bundle.source.document.id,
      meetingTitle: bundle.meeting.meeting.title || bundle.source.document.id,
    });
    const result = await this.deps.runNotesExport({
      documents: [bundle.source.document],
      format: action.format ?? "markdown",
      outputDir: resolveExportOutputDir(action.outputDir ?? this.deps.config.notes.output, scope, {
        scopedDirectory: action.scopedOutput,
      }),
      scope,
      trackLastRun: false,
      updateUi: false,
    });

    return {
      format: result.format,
      outputDir: result.outputDir,
      scope: result.scope,
      written: result.written,
    };
  }

  private async runAutomationTranscriptAction(
    match: GranolaAutomationMatch,
    action: GranolaAutomationExportTranscriptAction,
  ): Promise<
    | {
        format: string;
        outputDir: string;
        scope: GranolaExportScope;
        written: number;
      }
    | undefined
  > {
    const bundle = await this.deps.maybeReadMeetingBundleById(match.meetingId);
    if (!bundle) {
      return undefined;
    }

    const { source } = bundle;
    const cacheData = scopedCacheDataForMeeting(source);
    if (!cacheData) {
      return undefined;
    }

    const cacheDocument = cacheData.documents[source.document.id];
    const transcriptSegments = cacheData.transcripts[source.document.id];
    if (!cacheDocument || !transcriptSegments || transcriptSegments.length === 0) {
      return undefined;
    }

    const scope = meetingExportScope({
      meetingId: source.document.id,
      meetingTitle: bundle.meeting.meeting.title || source.document.id,
    });
    const result = await this.deps.runTranscriptsExport({
      cacheData: {
        documents: {
          [source.document.id]: cacheDocument,
        },
        transcripts: {
          [source.document.id]: transcriptSegments,
        },
      },
      format: action.format ?? "text",
      outputDir: resolveExportOutputDir(
        action.outputDir ?? this.deps.config.transcripts.output,
        scope,
        {
          scopedDirectory: action.scopedOutput,
        },
      ),
      scope,
      trackLastRun: false,
      updateUi: false,
    });

    return {
      format: result.format,
      outputDir: result.outputDir,
      scope: result.scope,
      written: result.written,
    };
  }

  private async buildAutomationExecutionBundle(
    match: GranolaAutomationMatch,
  ): Promise<GranolaMeetingBundle | undefined> {
    if (match.eventKind === "meeting.removed") {
      return undefined;
    }

    return await this.deps.maybeReadMeetingBundleById(match.meetingId, {
      requireCache: false,
    });
  }

  private buildAutomationDeliveryPayloadForAction(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: {
      id: string;
      kind: GranolaAutomationActionRun["actionKind"];
      name?: string;
    },
    context: AutomationActionContext,
    bundle: GranolaMeetingBundle | undefined,
  ) {
    return buildAutomationDeliveryPayload({
      action,
      artefact: context.artefact ? structuredClone(context.artefact) : undefined,
      bundle,
      decision: context.decision,
      generatedAt: this.deps.nowIso(),
      match: {
        ...match,
        folders: match.folders.map((folder) => ({ ...folder })),
        tags: [...match.tags],
      },
      note: context.note,
      rule,
      trigger: context.trigger,
    });
  }

  private async runAutomationCommand(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationCommandAction,
    context: AutomationActionContext,
  ): Promise<{
    command: string;
    cwd?: string;
    output?: string;
  }> {
    const bundle = await this.buildAutomationExecutionBundle(match);
    const cwd = action.cwd ? resolvePath(action.cwd) : process.cwd();
    const payload = JSON.stringify(
      {
        ...this.buildAutomationDeliveryPayloadForAction(
          match,
          rule,
          {
            id: action.id,
            kind: "command",
            name: automationActionName(action),
          },
          context,
          bundle,
        ),
        authMode: this.deps.state.auth.mode,
      },
      null,
      2,
    );

    return await new Promise((resolve, reject) => {
      const child = spawn(action.command, action.args ?? [], {
        cwd,
        env: {
          ...process.env,
          ...action.env,
          GRANOLA_ACTION_KIND: "command",
          GRANOLA_ACTION_TRIGGER: context.trigger,
          GRANOLA_APPROVAL_DECISION: context.decision,
          GRANOLA_ARTEFACT_ID: context.artefact?.id,
          GRANOLA_EVENT_ID: match.eventId,
          GRANOLA_EVENT_KIND: match.eventKind,
          GRANOLA_MATCH_ID: match.id,
          GRANOLA_MEETING_ID: match.meetingId,
          GRANOLA_RULE_ID: rule.id,
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;
      const timeoutMs = action.timeoutMs ?? this.deps.config.notes.timeoutMs;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      child.stderr.on("data", (chunk) => {
        stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        if (timedOut) {
          reject(new Error(`automation command timed out after ${timeoutMs}ms`));
          return;
        }

        if (code !== 0) {
          reject(
            new Error(stderr || stdout || `automation command exited with status ${String(code)}`),
          );
          return;
        }

        resolve({
          command: [action.command, ...(action.args ?? [])].join(" "),
          cwd,
          output: stdout || stderr || undefined,
        });
      });

      if (action.stdin !== "none") {
        child.stdin.write(payload);
      }
      child.stdin.end();
    });
  }

  private async runAutomationWebhook(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationWebhookAction,
    context: AutomationActionContext,
  ): Promise<{
    output?: string;
    status: number;
    url: string;
  }> {
    const bundle = await this.buildAutomationExecutionBundle(match);
    const payload = this.buildAutomationDeliveryPayloadForAction(
      match,
      rule,
      {
        id: action.id,
        kind: "webhook",
        name: automationActionName(action),
      },
      context,
      bundle,
    );
    const url = action.url?.trim() || (action.urlEnv ? process.env[action.urlEnv]?.trim() : "");
    if (!url) {
      throw new Error(`automation webhook action ${action.id} is missing a URL`);
    }

    const rendered = renderWebhookBody(action, payload);
    const response = await fetch(url, {
      body: rendered.body,
      headers: {
        "content-type": rendered.contentType,
        ...action.headers,
      },
      method: action.method ?? "POST",
    });
    const output = (await response.text()).trim() || undefined;
    if (!response.ok) {
      throw new Error(output || `automation webhook failed with status ${response.status}`);
    }

    return {
      output,
      status: response.status,
      url,
    };
  }

  private async runAutomationSlackMessage(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationSlackMessageAction,
    context: AutomationActionContext,
  ): Promise<{
    output?: string;
    status: number;
    text: string;
    url: string;
  }> {
    const bundle = await this.buildAutomationExecutionBundle(match);
    const payload = this.buildAutomationDeliveryPayloadForAction(
      match,
      rule,
      {
        id: action.id,
        kind: "slack-message",
        name: automationActionName(action),
      },
      context,
      bundle,
    );
    const url =
      action.webhookUrl?.trim() ||
      (action.webhookUrlEnv
        ? process.env[action.webhookUrlEnv]?.trim()
        : process.env.SLACK_WEBHOOK_URL?.trim());
    if (!url) {
      throw new Error(`automation Slack action ${action.id} is missing a webhook URL`);
    }

    const text = renderSlackMessageText(action, payload);
    const response = await fetch(url, {
      body: JSON.stringify({ text }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const output = (await response.text()).trim() || undefined;
    if (!response.ok) {
      throw new Error(output || `automation Slack action failed with status ${response.status}`);
    }

    return {
      output,
      status: response.status,
      text,
      url,
    };
  }

  private async runAutomationWriteFile(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationWriteFileAction,
    context: AutomationActionContext,
  ): Promise<{
    bytes: number;
    filePath: string;
    format: string;
  }> {
    const bundle = await this.buildAutomationExecutionBundle(match);
    const payload = this.buildAutomationDeliveryPayloadForAction(
      match,
      rule,
      {
        id: action.id,
        kind: "write-file",
        name: automationActionName(action),
      },
      context,
      bundle,
    );
    const filePath = resolveWriteFilePath(action, payload);
    if (existsSync(filePath) && action.overwrite === false) {
      throw new Error(`automation write-file target already exists: ${filePath}`);
    }

    const content = renderWriteFileContent(action, payload);
    await writeTextFile(filePath, content);
    return {
      bytes: Buffer.byteLength(content, "utf8"),
      filePath,
      format: action.format ?? "markdown",
    };
  }

  private async runAutomationPkmSync(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationPkmSyncAction,
    context: AutomationActionContext,
  ): Promise<{
    dailyNoteFilePath?: string;
    dailyNoteOpenUrl?: string;
    filePath: string;
    noteOpenUrl?: string;
    targetId: string;
    transcriptFilePath?: string;
    transcriptOpenUrl?: string;
  }> {
    if (!context.artefact) {
      throw new Error(`automation knowledge-base sync action ${action.id} requires an artefact`);
    }
    void rule;
    const result = await this.deps.runPkmSync(match.meetingId, action, context.artefact);

    return {
      dailyNoteFilePath: result.dailyNoteFilePath,
      dailyNoteOpenUrl: result.dailyNoteOpenUrl,
      filePath: result.filePath,
      noteOpenUrl: result.noteOpenUrl,
      targetId: result.targetId,
      transcriptFilePath: result.transcriptFilePath,
      transcriptOpenUrl: result.transcriptOpenUrl,
    };
  }

  private async buildAutomationAgentAttempt(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationAgentAction,
    bundle: GranolaMeetingBundle | undefined,
    harness: GranolaAgentHarness | undefined,
  ): Promise<ResolvedAutomationAgentAttempt> {
    const harnessCwd = harness?.cwd;
    const promptFile = await readOptionalActionFile(action.promptFile, action.cwd ?? harnessCwd);
    const harnessPromptFile = await readOptionalActionFile(harness?.promptFile, harnessCwd);
    const systemPromptFile = await readOptionalActionFile(
      action.systemPromptFile,
      action.cwd ?? harnessCwd,
    );
    const harnessSystemPromptFile = await readOptionalActionFile(
      harness?.systemPromptFile,
      harnessCwd,
    );
    let instructions = combinePromptSections(
      harnessPromptFile,
      harness?.prompt,
      promptFile,
      action.prompt,
    );
    if (!instructions) {
      throw new Error(`automation agent action ${action.id} is missing prompt instructions`);
    }

    if (action.pipeline) {
      instructions = buildPipelineInstructions(action.pipeline.kind, instructions);
    }

    const prompt = buildAutomationAgentPrompt(match, rule, instructions, bundle);
    return {
      harness,
      prompt,
      request: {
        cwd: action.cwd ?? harnessCwd,
        dryRun: action.dryRun,
        model: action.model ?? harness?.model,
        prompt,
        provider: action.provider ?? harness?.provider,
        retries: action.retries,
        systemPrompt: combinePromptSections(
          harnessSystemPromptFile,
          harness?.systemPrompt,
          systemPromptFile,
          action.systemPrompt,
        ),
        timeoutMs: action.timeoutMs,
      },
      systemPrompt: combinePromptSections(
        harnessSystemPromptFile,
        harness?.systemPrompt,
        systemPromptFile,
        action.systemPrompt,
      ),
    };
  }
}
