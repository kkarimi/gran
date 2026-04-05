import type {
  GranolaAutomationAction,
  GranolaAutomationAgentAction,
  GranolaAutomationArtefactAttempt,
  GranolaAutomationActionRun,
  GranolaAutomationCommandAction,
  GranolaAutomationExportNotesAction,
  GranolaAutomationExportTranscriptAction,
  GranolaAutomationMatch,
  GranolaAutomationRule,
  GranolaExportScope,
} from "./app/index.ts";

function cloneAction(action: GranolaAutomationAction): GranolaAutomationAction {
  switch (action.kind) {
    case "agent":
      return {
        ...action,
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
  }
}

export function automationActionName(action: GranolaAutomationAction): string {
  return action.name || action.id;
}

export function buildAutomationActionRunId(
  match: GranolaAutomationMatch,
  actionId: string,
): string {
  return `${match.id}:${actionId}`;
}

export function enabledAutomationActions(rule: GranolaAutomationRule): GranolaAutomationAction[] {
  return (rule.actions ?? [])
    .filter((action) => action.enabled !== false)
    .map((action) => cloneAction(action));
}

export interface AutomationActionCommandResult {
  command: string;
  cwd?: string;
  output?: string;
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
  ): Promise<AutomationActionCommandResult>;
}

function baseRun(
  match: GranolaAutomationMatch,
  rule: GranolaAutomationRule,
  action: GranolaAutomationAction,
  startedAt: string,
  options: {
    rerunOfId?: string;
    runId?: string;
  } = {},
): GranolaAutomationActionRun {
  return {
    actionId: action.id,
    actionKind: action.kind,
    actionName: automationActionName(action),
    artefactIds: undefined,
    eventId: match.eventId,
    eventKind: match.eventKind,
    folders: match.folders.map((folder) => ({ ...folder })),
    id: options.runId ?? buildAutomationActionRunId(match, action.id),
    matchId: match.id,
    matchedAt: match.matchedAt,
    meetingId: match.meetingId,
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
    rerunOfId?: string;
    runId?: string;
  } = {},
): Promise<GranolaAutomationActionRun> {
  const startedAt = handlers.nowIso();
  const run = baseRun(match, rule, action, startedAt, options);

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
        const result = await handlers.runCommand(match, rule, action);
        return completedRun(run, handlers.nowIso(), {
          meta: {
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
  }
}
