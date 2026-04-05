import { enabledAutomationActions } from "./automation-actions.ts";
import { matchAutomationRules } from "./automation-rules.ts";
import type {
  GranolaAutomationActionRun,
  GranolaAutomationAgentAction,
  GranolaAutomationArtefact,
  GranolaAutomationMatch,
  GranolaAutomationRule,
  GranolaAppSyncEvent,
  GranolaAppSyncState,
  GranolaProcessingIssue,
  GranolaProcessingIssueKind,
  GranolaProcessingIssueSeverity,
  MeetingSummaryRecord,
} from "./app/index.ts";

const SYNC_STALE_THRESHOLD_MS = 30 * 60 * 1000;
const TRANSCRIPT_MISSING_GRACE_MS = 15 * 60 * 1000;

export interface GranolaProcessingRecoveryContext {
  action: GranolaAutomationAgentAction;
  match: GranolaAutomationMatch;
  rule: GranolaAutomationRule;
}

function parseTime(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function issueSeverity(kind: GranolaProcessingIssueKind): GranolaProcessingIssueSeverity {
  switch (kind) {
    case "pipeline-failed":
    case "sync-stale":
      return "error";
    case "artefact-stale":
    case "pipeline-missing":
    case "transcript-missing":
    default:
      return "warning";
  }
}

function issueTitle(kind: GranolaProcessingIssueKind, title: string): string {
  switch (kind) {
    case "pipeline-failed":
      return `Pipeline failed: ${title}`;
    case "pipeline-missing":
      return `Pipeline missing: ${title}`;
    case "artefact-stale":
      return `Artefact stale: ${title}`;
    case "transcript-missing":
      return `Transcript missing: ${title}`;
    case "sync-stale":
    default:
      return title;
  }
}

function eventPriority(kind: GranolaAppSyncEvent["kind"]): number {
  switch (kind) {
    case "transcript.ready":
      return 0;
    case "meeting.changed":
      return 1;
    case "meeting.created":
      return 2;
    case "meeting.removed":
    default:
      return 3;
  }
}

function latestRunTime(run: GranolaAutomationActionRun): string {
  return run.finishedAt ?? run.startedAt;
}

function buildMeetingRecoveryEvents(
  meeting: MeetingSummaryRecord,
  detectedAt: string,
): GranolaAppSyncEvent[] {
  const baseEvent = {
    folders: meeting.folders.map((folder) => ({ ...folder })),
    meetingId: meeting.id,
    occurredAt: detectedAt,
    runId: "recovery",
    tags: [...meeting.tags],
    title: meeting.title,
    transcriptLoaded: meeting.transcriptLoaded,
    updatedAt: meeting.updatedAt,
  };

  return [
    {
      ...baseEvent,
      id: `recovery:${meeting.id}:meeting.changed`,
      kind: "meeting.changed",
    },
    {
      ...baseEvent,
      id: `recovery:${meeting.id}:meeting.created`,
      kind: "meeting.created",
    },
    ...(meeting.transcriptLoaded
      ? [
          {
            ...baseEvent,
            id: `recovery:${meeting.id}:transcript.ready`,
            kind: "transcript.ready" as const,
          },
        ]
      : []),
  ];
}

export function buildProcessingIssueId(
  kind: GranolaProcessingIssueKind,
  options: {
    actionId?: string;
    meetingId?: string;
    ruleId?: string;
  } = {},
): string {
  return [kind, options.meetingId ?? "", options.ruleId ?? "", options.actionId ?? ""].join(":");
}

export function parseProcessingIssueId(id: string): {
  actionId?: string;
  kind: GranolaProcessingIssueKind;
  meetingId?: string;
  ruleId?: string;
} {
  const [kind, meetingId, ruleId, actionId] = id.split(":");
  if (
    kind !== "artefact-stale" &&
    kind !== "pipeline-failed" &&
    kind !== "pipeline-missing" &&
    kind !== "sync-stale" &&
    kind !== "transcript-missing"
  ) {
    throw new Error(`invalid processing issue id: ${id}`);
  }

  return {
    actionId: actionId || undefined,
    kind,
    meetingId: meetingId || undefined,
    ruleId: ruleId || undefined,
  };
}

export function collectPipelineRecoveryContexts(
  rules: GranolaAutomationRule[],
  meeting: MeetingSummaryRecord,
  detectedAt: string,
): GranolaProcessingRecoveryContext[] {
  const matches = matchAutomationRules(
    rules,
    buildMeetingRecoveryEvents(meeting, detectedAt),
    detectedAt,
  )
    .slice()
    .sort((left, right) => eventPriority(left.eventKind) - eventPriority(right.eventKind));
  const rulesById = new Map(rules.map((rule) => [rule.id, rule] as const));
  const contexts = new Map<string, GranolaProcessingRecoveryContext>();

  for (const match of matches) {
    const rule = rulesById.get(match.ruleId);
    if (!rule) {
      continue;
    }

    for (const action of enabledAutomationActions(rule)) {
      if (action.kind !== "agent" || !action.pipeline) {
        continue;
      }

      const key = `${rule.id}:${action.id}`;
      if (contexts.has(key)) {
        continue;
      }

      contexts.set(key, {
        action,
        match,
        rule,
      });
    }
  }

  return [...contexts.values()];
}

function buildIssue(options: {
  actionId?: string;
  detail: string;
  detectedAt: string;
  kind: GranolaProcessingIssueKind;
  meetingId?: string;
  recoverable?: boolean;
  ruleId?: string;
  title: string;
}): GranolaProcessingIssue {
  return {
    actionId: options.actionId,
    detail: options.detail,
    detectedAt: options.detectedAt,
    id: buildProcessingIssueId(options.kind, {
      actionId: options.actionId,
      meetingId: options.meetingId,
      ruleId: options.ruleId,
    }),
    kind: options.kind,
    meetingId: options.meetingId,
    recoverable: options.recoverable ?? true,
    ruleId: options.ruleId,
    severity: issueSeverity(options.kind),
    title: issueTitle(options.kind, options.title),
  };
}

export function buildProcessingIssues(options: {
  artefacts: GranolaAutomationArtefact[];
  meetings: MeetingSummaryRecord[];
  nowIso: string;
  rules: GranolaAutomationRule[];
  runs: GranolaAutomationActionRun[];
  syncState: GranolaAppSyncState;
}): GranolaProcessingIssue[] {
  const issues: GranolaProcessingIssue[] = [];
  const nowTime = parseTime(options.nowIso) ?? 0;
  const lastSyncTime = parseTime(options.syncState.lastCompletedAt);

  if (!lastSyncTime || nowTime - lastSyncTime > SYNC_STALE_THRESHOLD_MS) {
    issues.push(
      buildIssue({
        detail: options.syncState.lastCompletedAt
          ? `Last sync completed at ${options.syncState.lastCompletedAt}.`
          : "No successful sync has completed yet.",
        detectedAt: options.nowIso,
        kind: "sync-stale",
        recoverable: true,
        title: "Sync needs attention",
      }),
    );
  }

  for (const meeting of options.meetings) {
    const meetingTime = parseTime(meeting.updatedAt) ?? parseTime(meeting.createdAt) ?? 0;
    if (!meeting.transcriptLoaded && nowTime - meetingTime > TRANSCRIPT_MISSING_GRACE_MS) {
      issues.push(
        buildIssue({
          detail: "Transcript data has not been captured for this meeting yet.",
          detectedAt: options.nowIso,
          kind: "transcript-missing",
          meetingId: meeting.id,
          title: meeting.title || meeting.id,
        }),
      );
    }

    const contexts = collectPipelineRecoveryContexts(options.rules, meeting, options.nowIso);
    for (const context of contexts) {
      const latestRun = options.runs
        .filter(
          (run) =>
            run.meetingId === meeting.id &&
            run.ruleId === context.rule.id &&
            run.actionId === context.action.id,
        )
        .slice()
        .sort((left, right) => latestRunTime(right).localeCompare(latestRunTime(left)))[0];
      const latestArtefact = options.artefacts
        .filter(
          (artefact) =>
            artefact.meetingId === meeting.id &&
            artefact.ruleId === context.rule.id &&
            artefact.actionId === context.action.id &&
            artefact.status !== "superseded",
        )
        .slice()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

      if (latestRun?.status === "failed") {
        issues.push(
          buildIssue({
            actionId: context.action.id,
            detail: latestRun.error || latestRun.result || "The most recent pipeline run failed.",
            detectedAt: options.nowIso,
            kind: "pipeline-failed",
            meetingId: meeting.id,
            ruleId: context.rule.id,
            title: meeting.title || meeting.id,
          }),
        );
        continue;
      }

      if (!latestArtefact) {
        issues.push(
          buildIssue({
            actionId: context.action.id,
            detail: "No current pipeline artefact exists for this meeting.",
            detectedAt: options.nowIso,
            kind: "pipeline-missing",
            meetingId: meeting.id,
            ruleId: context.rule.id,
            title: meeting.title || meeting.id,
          }),
        );
        continue;
      }

      const artefactTime = parseTime(latestArtefact.updatedAt) ?? 0;
      if (artefactTime < meetingTime) {
        issues.push(
          buildIssue({
            actionId: context.action.id,
            detail: `Meeting updated at ${meeting.updatedAt}, but the latest artefact is from ${latestArtefact.updatedAt}.`,
            detectedAt: options.nowIso,
            kind: "artefact-stale",
            meetingId: meeting.id,
            ruleId: context.rule.id,
            title: meeting.title || meeting.id,
          }),
        );
      }
    }
  }

  return issues.sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "error" ? -1 : 1;
    }

    return right.detectedAt.localeCompare(left.detectedAt);
  });
}
