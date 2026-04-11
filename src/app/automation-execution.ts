import {
  resolveAgentHarness,
  type AgentHarnessStore,
  type GranolaAgentHarness,
} from "../agent-harnesses.ts";
import {
  createDefaultAutomationAgentRunner,
  type GranolaAutomationAgentRequest,
  type GranolaAutomationAgentRunner,
} from "../agents.ts";
import type { GranolaAgentProviderRegistry } from "../agent-provider-registry.ts";
import {
  automationActionName,
  buildAutomationActionRunId,
  enabledAutomationActions,
  executeAutomationAction,
  type AutomationActionAgentResult,
  type AutomationActionExecutionHandlers,
} from "../automation-actions.ts";
import type { GranolaAutomationActionRegistry } from "../automation-action-registry.ts";
import { defaultHarnessEventKind } from "./automation-evaluation.ts";
import {
  cloneAutomationArtefact,
  cloneAutomationMatch,
  cloneAutomationRun,
  type GranolaAutomationStateRepository,
} from "./automation-state.ts";
import { matchAutomationRules } from "../automation-rules.ts";
import { parsePipelineOutput } from "../processing.ts";
import type { AppConfig } from "../types.ts";

import type {
  GranolaAutomationAgentAction,
  GranolaAutomationActionRun,
  GranolaAutomationArtefact,
  GranolaAutomationArtefactAttempt,
  GranolaAutomationMatch,
  GranolaAutomationRule,
  GranolaAutomationApprovalMode,
  GranolaAppSyncEvent,
  GranolaMeetingBundle,
} from "./types.ts";

interface ResolvedAutomationAgentAttempt {
  harness?: GranolaAgentHarness;
  prompt: string;
  request: GranolaAutomationAgentRequest;
  systemPrompt?: string;
}

export interface GranolaAutomationExecutionServiceHandlers extends Pick<
  AutomationActionExecutionHandlers,
  | "exportNotes"
  | "exportTranscripts"
  | "runCommand"
  | "runPkmSync"
  | "runSlackMessage"
  | "runWebhook"
  | "writeFile"
> {
  prepareAgentAttempt(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationAgentAction,
    bundle: GranolaMeetingBundle | undefined,
    harness: GranolaAgentHarness | undefined,
  ): Promise<ResolvedAutomationAgentAttempt>;
}

interface GranolaAutomationExecutionServiceDependencies {
  agentHarnessStore?: AgentHarnessStore;
  agentProviderRegistry?: GranolaAgentProviderRegistry;
  agentRunner?: GranolaAutomationAgentRunner;
  automationActionRegistry?: GranolaAutomationActionRegistry;
  automationState: GranolaAutomationStateRepository;
  config: AppConfig;
  emitStateUpdate: () => void;
  handlers: GranolaAutomationExecutionServiceHandlers;
  maybeReadMeetingBundleById: (
    id: string,
    options?: { requireCache?: boolean },
  ) => Promise<GranolaMeetingBundle | undefined>;
  nowIso: () => string;
  resolveAutomationArtefact: (
    id: string,
    decision: "approve" | "reject",
    options: { note?: string; targetId?: string },
  ) => Promise<GranolaAutomationArtefact>;
}

function buildAutomationArtefactId(runId: string, kind: GranolaAutomationArtefact["kind"]): string {
  return `${kind}:${runId}`;
}

export class GranolaAutomationExecutionService {
  constructor(private readonly deps: GranolaAutomationExecutionServiceDependencies) {}

  handlers(): AutomationActionExecutionHandlers {
    return {
      exportNotes: async (match, action) => await this.deps.handlers.exportNotes(match, action),
      exportTranscripts: async (match, action) =>
        await this.deps.handlers.exportTranscripts(match, action),
      nowIso: () => this.deps.nowIso(),
      runAgent: async (match, rule, action, run) =>
        await this.runAutomationAgent(match, rule, action, run),
      runCommand: async (match, rule, action, context) =>
        await this.deps.handlers.runCommand(match, rule, action, context),
      runPkmSync: async (match, rule, action, context) =>
        await this.deps.handlers.runPkmSync(match, rule, action, context),
      runSlackMessage: async (match, rule, action, context) =>
        await this.deps.handlers.runSlackMessage(match, rule, action, context),
      runWebhook: async (match, rule, action, context) =>
        await this.deps.handlers.runWebhook(match, rule, action, context),
      writeFile: async (match, rule, action, context) =>
        await this.deps.handlers.writeFile(match, rule, action, context),
    };
  }

  async runIntelligencePreset(options: {
    approvalMode?: GranolaAutomationApprovalMode;
    bundles: GranolaMeetingBundle[];
    model?: GranolaAutomationAgentAction["model"];
    preset: { id: string; label: string; prompt: string };
    provider?: GranolaAutomationAgentAction["provider"];
  }): Promise<{
    artefacts: GranolaAutomationArtefact[];
    runs: GranolaAutomationActionRun[];
  }> {
    const generatedAt = this.deps.nowIso();
    const action: GranolaAutomationAgentAction = {
      approvalMode: options.approvalMode ?? "manual",
      id: `intelligence:${options.preset.id}`,
      kind: "agent",
      model: options.model,
      pipeline: { kind: "enrichment" },
      prompt: options.preset.prompt,
      provider: options.provider,
    };
    const rule: GranolaAutomationRule = {
      id: `intelligence:${options.preset.id}`,
      name: `Intelligence: ${options.preset.label}`,
      when: {},
    };
    const runs: GranolaAutomationActionRun[] = [];

    for (const bundle of options.bundles) {
      const meeting = bundle.meeting.meeting;
      const matchId = `intelligence:${options.preset.id}:${bundle.source.document.id}:${generatedAt}`;
      const match: GranolaAutomationMatch = {
        eventId: matchId,
        eventKind: defaultHarnessEventKind(bundle),
        folders: meeting.folders.map((folder) => ({ ...folder })),
        id: matchId,
        matchedAt: generatedAt,
        meetingId: bundle.source.document.id,
        ruleId: rule.id,
        ruleName: rule.name,
        tags: [...meeting.tags],
        title: meeting.title || bundle.source.document.title || bundle.source.document.id,
        transcriptLoaded: meeting.transcriptLoaded,
      };

      runs.push(
        await executeAutomationAction(match, rule, action, this.handlers(), {
          registry: this.deps.automationActionRegistry,
          runId: matchId,
        }),
      );
    }

    await this.deps.automationState.appendRuns(runs);
    this.deps.emitStateUpdate();

    const allArtefacts = this.deps.automationState.artefacts();
    const artefacts = runs
      .flatMap((run) => run.artefactIds ?? [])
      .map((id) => allArtefacts.find((artefact) => artefact.id === id))
      .filter((artefact): artefact is GranolaAutomationArtefact => Boolean(artefact))
      .map((artefact) => cloneAutomationArtefact(artefact));

    return {
      artefacts,
      runs: runs.map((run) => cloneAutomationRun(run)),
    };
  }

  async processSyncEvents(
    events: GranolaAppSyncEvent[],
    matchedAt: string,
  ): Promise<{
    matches: GranolaAutomationMatch[];
    runs: GranolaAutomationActionRun[];
  }> {
    const rules = await this.deps.automationState.loadRules();
    const automationMatches = matchAutomationRules(rules, events, matchedAt);
    await this.deps.automationState.appendMatches(automationMatches);
    const runs = await this.runAutomationActions(rules, automationMatches);
    return {
      matches: automationMatches.map((match) => cloneAutomationMatch(match)),
      runs,
    };
  }

  private async runAutomationAgent(
    match: GranolaAutomationMatch,
    rule: GranolaAutomationRule,
    action: GranolaAutomationAgentAction,
    run: GranolaAutomationActionRun,
  ): Promise<AutomationActionAgentResult> {
    const bundle =
      match.eventKind === "meeting.removed"
        ? undefined
        : await this.deps.maybeReadMeetingBundleById(match.meetingId, {
            requireCache: false,
          });
    const harnesses = this.deps.agentHarnessStore
      ? await this.deps.agentHarnessStore.readHarnesses()
      : [];
    const primaryHarness = resolveAgentHarness(harnesses, { bundle, match }, action.harnessId);
    const fallbackHarnessIds = [
      ...(action.fallbackHarnessIds ?? []),
      ...(primaryHarness?.fallbackHarnessIds ?? []),
    ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
    const attempts = [
      await this.deps.handlers.prepareAgentAttempt(match, rule, action, bundle, primaryHarness),
      ...(await Promise.all(
        fallbackHarnessIds
          .filter((harnessId) => harnessId !== primaryHarness?.id)
          .map(async (harnessId) => {
            const fallbackHarness = resolveAgentHarness(harnesses, { bundle, match }, harnessId);
            return await this.deps.handlers.prepareAgentAttempt(
              match,
              rule,
              action,
              bundle,
              fallbackHarness,
            );
          }),
      )),
    ];
    const runner =
      this.deps.agentRunner ??
      createDefaultAutomationAgentRunner(this.deps.config, {
        providerRegistry: this.deps.agentProviderRegistry,
      });
    const attemptMeta: GranolaAutomationArtefactAttempt[] = [];
    let lastError: unknown;

    for (const attempt of attempts) {
      try {
        const result = await runner.run(attempt.request);
        attemptMeta.push({
          harnessId: attempt.harness?.id,
          model: result.model,
          provider:
            result.provider === "codex" ||
            result.provider === "openai" ||
            result.provider === "openrouter"
              ? result.provider
              : undefined,
        });

        if (action.pipeline) {
          const parsed = parsePipelineOutput({
            kind: action.pipeline.kind,
            meetingTitle: match.title,
            rawOutput: result.output ?? "",
            roleHelpers: bundle?.meeting.roleHelpers,
          });
          const createdAt = this.deps.nowIso();
          const artefact: GranolaAutomationArtefact = {
            actionId: action.id,
            actionName: automationActionName(action),
            attempts: attemptMeta.map((item) => ({ ...item })),
            createdAt,
            eventId: match.eventId,
            history: [
              {
                action: "generated",
                at: createdAt,
                note: run.rerunOfId ? `Rerun of ${run.rerunOfId}` : undefined,
              },
            ],
            id: buildAutomationArtefactId(run.id, action.pipeline.kind),
            kind: action.pipeline.kind,
            matchId: match.id,
            meetingId: match.meetingId,
            model: result.model,
            parseMode: parsed.parseMode,
            prompt: result.prompt,
            provider:
              result.provider === "codex" ||
              result.provider === "openai" ||
              result.provider === "openrouter"
                ? result.provider
                : "codex",
            rawOutput: result.output ?? "",
            rerunOfId: run.rerunOfId
              ? buildAutomationArtefactId(run.rerunOfId, action.pipeline.kind)
              : undefined,
            ruleId: rule.id,
            ruleName: rule.name,
            runId: run.id,
            status: "generated",
            structured: parsed.structured,
            updatedAt: createdAt,
          };
          await this.deps.automationState.writeArtefacts([
            artefact,
            ...this.deps.automationState.artefacts(),
          ]);
          const finalArtefact =
            (action.approvalMode ?? "manual") === "auto"
              ? await this.deps.resolveAutomationArtefact(artefact.id, "approve", {
                  note: "Auto-approved by automation rule",
                })
              : artefact;

          return {
            artefactIds: [finalArtefact.id],
            attempts: attemptMeta,
            command: result.command,
            dryRun: result.dryRun,
            model: result.model,
            output: parsed.structured.summary ?? parsed.structured.markdown,
            pipelineKind: action.pipeline.kind,
            prompt: result.prompt,
            provider: result.provider,
            systemPrompt: result.systemPrompt,
          };
        }

        return {
          attempts: attemptMeta,
          command: result.command,
          dryRun: result.dryRun,
          model: result.model,
          output: result.output,
          prompt: result.prompt,
          provider: result.provider,
          systemPrompt: result.systemPrompt,
        };
      } catch (error) {
        lastError = error;
        attemptMeta.push({
          error: error instanceof Error ? error.message : String(error),
          harnessId: attempt.harness?.id,
          model: attempt.request.model,
          provider: attempt.request.provider,
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(
          typeof lastError === "string"
            ? lastError
            : lastError
              ? JSON.stringify(lastError)
              : "automation agent failed",
        );
  }

  private async runAutomationActions(
    rules: GranolaAutomationRule[],
    matches: GranolaAutomationMatch[],
  ): Promise<GranolaAutomationActionRun[]> {
    const rulesById = new Map(rules.map((rule) => [rule.id, rule] as const));
    const existingRunIds = new Set(this.deps.automationState.runs().map((run) => run.id));
    const runs: GranolaAutomationActionRun[] = [];

    for (const match of matches) {
      const rule = rulesById.get(match.ruleId);
      if (!rule) {
        continue;
      }

      for (const action of enabledAutomationActions(rule, {
        registry: this.deps.automationActionRegistry,
      })) {
        const runId = buildAutomationActionRunId(match, action.id);
        if (existingRunIds.has(runId)) {
          continue;
        }

        existingRunIds.add(runId);
        runs.push(
          await executeAutomationAction(match, rule, action, this.handlers(), {
            registry: this.deps.automationActionRegistry,
          }),
        );
      }
    }

    await this.deps.automationState.appendRuns(runs);
    return runs.map((run) => cloneAutomationRun(run));
  }
}
