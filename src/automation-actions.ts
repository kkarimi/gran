import type {
  GranolaAutomationAction,
  GranolaAutomationAgentAction,
  GranolaAutomationArtefactAttempt,
  GranolaAutomationActionRun,
  GranolaAutomationActionTrigger,
  GranolaAutomationCommandAction,
  GranolaAutomationExportNotesAction,
  GranolaAutomationExportTranscriptAction,
  GranolaAutomationMatch,
  GranolaAutomationRule,
  GranolaAutomationSlackMessageAction,
  GranolaAutomationWebhookAction,
  GranolaAutomationWriteFileAction,
  GranolaAutomationArtefact,
  GranolaExportScope,
} from "./app/index.ts";

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

export function automationActionName(action: GranolaAutomationAction): string {
  return action.name || action.id;
}

export function automationActionTrigger(
  action: GranolaAutomationAction,
): GranolaAutomationActionTrigger {
  switch (action.kind) {
    case "command":
    case "slack-message":
    case "webhook":
    case "write-file":
      return action.trigger ?? "match";
    default:
      return "match";
  }
}

export function buildAutomationActionRunId(
  match: GranolaAutomationMatch,
  actionId: string,
): string {
  return `${match.id}:${actionId}`;
}

export function buildAutomationApprovalActionRunId(
  artefact: GranolaAutomationArtefact,
  actionId: string,
): string {
  return `approval:${artefact.id}:${actionId}`;
}

export function enabledAutomationActions(
  rule: GranolaAutomationRule,
  options: { sourceActionId?: string; trigger?: GranolaAutomationActionTrigger } = {},
): GranolaAutomationAction[] {
  return (rule.actions ?? [])
    .filter((action) => action.enabled !== false)
    .filter((action) => automationActionTrigger(action) === (options.trigger ?? "match"))
    .filter((action) => {
      if (options.trigger !== "approval") {
        return true;
      }

      switch (action.kind) {
        case "command":
        case "slack-message":
        case "webhook":
        case "write-file":
          return !options.sourceActionId || action.sourceActionId === options.sourceActionId;
        default:
          return false;
      }
    })
    .map((action) => cloneAction(action));
}

export interface AutomationActionCommandResult {
  command: string;
  cwd?: string;
  output?: string;
}

export interface AutomationActionContext {
  artefact?: GranolaAutomationArtefact;
  decision?: "approve" | "reject";
  note?: string;
  trigger: GranolaAutomationActionTrigger;
}

export interface AutomationActionAgentResult {
  artefactIds?: string[];
  attempts?: GranolaAutomationArtefactAttempt[];
  command?: string;
  dryRun: boolean;
  model: string;
  output?: string;
  pipelineKind?: string;
  prompt: string;
  provider: string;
  systemPrompt?: string;
}

export interface AutomationActionExportResult {
  format: string;
  outputDir: string;
  scope: GranolaExportScope;
  written: number;
}

export interface AutomationActionSlackResult {
  output?: string;
  status: number;
  text: string;
  url: string;
}

export interface AutomationActionWebhookResult {
  output?: string;
  status: number;
  url: string;
}

export interface AutomationActionWriteFileResult {
  bytes: number;
  filePath: string;
  format: string;
}

export interface AutomationActionExecutionHandlers {
  exportNotes(
    match: GranolaAutomationMatch,
    action: GranolaAutomationExportNotesAction,
  ): Promise<AutomationActionExportResult | undefined>;
  exportTranscripts(
    match: GranolaAutomationMatch,
    action: GranolaAutomationExportTranscriptAction,
  ): Promise<AutomationActionExportResult | undefined>;
  nowIso(): string;
  runAgent(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationAgentAction,
    run: GranolaAutomationActionRun,
  ): Promise<AutomationActionAgentResult>;
  runCommand(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationCommandAction,
    context: AutomationActionContext,
  ): Promise<AutomationActionCommandResult>;
  runSlackMessage(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationSlackMessageAction,
    context: AutomationActionContext,
  ): Promise<AutomationActionSlackResult>;
  runWebhook(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationWebhookAction,
    context: AutomationActionContext,
  ): Promise<AutomationActionWebhookResult>;
  writeFile(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationWriteFileAction,
    context: AutomationActionContext,
  ): Promise<AutomationActionWriteFileResult>;
}

function baseRun(
  match: GranolaAutomationMatch,
  rule: GranolaAutomationRule,
  action: GranolaAutomationAction,
  startedAt: string,
  context: AutomationActionContext,
  options: {
    rerunOfId?: string;
    runId?: string;
  } = {},
): GranolaAutomationActionRun {
  return {
    actionId: action.id,
    actionKind: action.kind,
    actionName: automationActionName(action),
    artefactIds: context.artefact ? [context.artefact.id] : undefined,
    eventId: match.eventId,
    eventKind: match.eventKind,
    folders: match.folders.map((folder) => ({ ...folder })),
    id: options.runId ?? buildAutomationActionRunId(match, action.id),
    matchId: match.id,
    matchedAt: match.matchedAt,
    meetingId: match.meetingId,
    meta: {
      sourceActionId:
        action.kind === "command" ||
        action.kind === "slack-message" ||
        action.kind === "webhook" ||
        action.kind === "write-file"
          ? action.sourceActionId
          : undefined,
      trigger: context.trigger,
    },
    ruleId: rule.id,
    ruleName: rule.name,
    rerunOfId: options.rerunOfId,
    startedAt,
    status: "completed",
    tags: [...match.tags],
    title: match.title,
    transcriptLoaded: match.transcriptLoaded,
  };
}

function completedRun(
  run: GranolaAutomationActionRun,
  finishedAt: string,
  patch: Partial<GranolaAutomationActionRun> = {},
): GranolaAutomationActionRun {
  return {
    ...run,
    ...patch,
    finishedAt,
    status: "completed",
  };
}

function failedRun(
  run: GranolaAutomationActionRun,
  finishedAt: string,
  error: unknown,
): GranolaAutomationActionRun {
  return {
    ...run,
    error: error instanceof Error ? error.message : String(error),
    finishedAt,
    status: "failed",
  };
}

function skippedRun(
  run: GranolaAutomationActionRun,
  finishedAt: string,
  reason: string,
): GranolaAutomationActionRun {
  return {
    ...run,
    finishedAt,
    result: reason,
    status: "skipped",
  };
}

export async function executeAutomationAction(
  match: GranolaAutomationMatch,
  rule: GranolaAutomationRule,
  action: GranolaAutomationAction,
  handlers: AutomationActionExecutionHandlers,
  options: {
    context?: AutomationActionContext;
    rerunOfId?: string;
    runId?: string;
  } = {},
): Promise<GranolaAutomationActionRun> {
  const context: AutomationActionContext = options.context ?? {
    trigger: automationActionTrigger(action),
  };
  const startedAt = handlers.nowIso();
  const run = baseRun(match, rule, action, startedAt, context, options);

  switch (action.kind) {
    case "agent":
      try {
        const result = await handlers.runAgent(match, rule, action, run);
        return completedRun(run, handlers.nowIso(), {
          artefactIds: result.artefactIds ? [...result.artefactIds] : undefined,
          meta: {
            attempts: result.attempts,
            artefactIds: result.artefactIds,
            command: result.command,
            dryRun: result.dryRun,
            model: result.model,
            pipelineKind: result.pipelineKind,
            provider: result.provider,
            systemPrompt: result.systemPrompt,
          },
          prompt: result.prompt,
          result: result.output ?? (result.dryRun ? "Dry run: provider request not executed" : ""),
        });
      } catch (error) {
        return failedRun(run, handlers.nowIso(), error);
      }
    case "ask-user":
      return {
        ...run,
        meta: action.details ? { details: action.details } : undefined,
        prompt: action.prompt,
        result: "Pending user decision",
        status: "pending",
      };
    case "command":
      try {
        const result = await handlers.runCommand(match, rule, action, context);
        return completedRun(run, handlers.nowIso(), {
          meta: {
            ...(run.meta ? structuredClone(run.meta) : {}),
            command: result.command,
            cwd: result.cwd,
          },
          result: result.output,
        });
      } catch (error) {
        return failedRun(run, handlers.nowIso(), error);
      }
    case "export-notes":
      try {
        const result = await handlers.exportNotes(match, action);
        if (!result) {
          return skippedRun(run, handlers.nowIso(), "Meeting notes were unavailable for export");
        }

        return completedRun(run, handlers.nowIso(), {
          meta: {
            format: result.format,
            outputDir: result.outputDir,
            scope: result.scope,
            written: result.written,
          },
          result: `Exported notes to ${result.outputDir}`,
        });
      } catch (error) {
        return failedRun(run, handlers.nowIso(), error);
      }
    case "export-transcript":
      try {
        const result = await handlers.exportTranscripts(match, action);
        if (!result) {
          return skippedRun(run, handlers.nowIso(), "Transcript data was unavailable for export");
        }

        return completedRun(run, handlers.nowIso(), {
          meta: {
            format: result.format,
            outputDir: result.outputDir,
            scope: result.scope,
            written: result.written,
          },
          result: `Exported transcript to ${result.outputDir}`,
        });
      } catch (error) {
        return failedRun(run, handlers.nowIso(), error);
      }
    case "slack-message":
      try {
        const result = await handlers.runSlackMessage(match, rule, action, context);
        return completedRun(run, handlers.nowIso(), {
          meta: {
            ...(run.meta ? structuredClone(run.meta) : {}),
            status: result.status,
            text: result.text,
            url: result.url,
          },
          result: result.output ?? `Posted Slack message (${result.status})`,
        });
      } catch (error) {
        return failedRun(run, handlers.nowIso(), error);
      }
    case "webhook":
      try {
        const result = await handlers.runWebhook(match, rule, action, context);
        return completedRun(run, handlers.nowIso(), {
          meta: {
            ...(run.meta ? structuredClone(run.meta) : {}),
            status: result.status,
            url: result.url,
          },
          result: result.output ?? `Posted webhook (${result.status})`,
        });
      } catch (error) {
        return failedRun(run, handlers.nowIso(), error);
      }
    case "write-file":
      try {
        const result = await handlers.writeFile(match, rule, action, context);
        return completedRun(run, handlers.nowIso(), {
          meta: {
            ...(run.meta ? structuredClone(run.meta) : {}),
            bytes: result.bytes,
            filePath: result.filePath,
            format: result.format,
          },
          result: `Wrote ${result.format} file to ${result.filePath}`,
        });
      } catch (error) {
        return failedRun(run, handlers.nowIso(), error);
      }
  }
}
