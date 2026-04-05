import type {
  GranolaAutomationActionRun,
  GranolaAutomationArtefact,
  GranolaProcessingIssue,
} from "./app/types.ts";

export type GranolaReviewInboxItem =
  | {
      artefact: GranolaAutomationArtefact;
      key: string;
      kind: "artefact";
      meetingId: string;
      priority: number;
      status: string;
      subtitle: string;
      summary: string;
      timestamp: string;
      title: string;
    }
  | {
      issue: GranolaProcessingIssue;
      key: string;
      kind: "issue";
      meetingId?: string;
      priority: number;
      status: string;
      subtitle: string;
      summary: string;
      timestamp: string;
      title: string;
    }
  | {
      key: string;
      kind: "run";
      meetingId: string;
      priority: number;
      run: GranolaAutomationActionRun;
      status: string;
      subtitle: string;
      summary: string;
      timestamp: string;
      title: string;
    };

export interface GranolaReviewInboxSummary {
  artefacts: number;
  issues: number;
  runs: number;
  total: number;
}

function issuePriority(issue: GranolaProcessingIssue): number {
  if (issue.severity === "error" && issue.recoverable) {
    return 0;
  }

  if (issue.severity === "error") {
    return 1;
  }

  return 4;
}

function runPriority(_run: GranolaAutomationActionRun): number {
  return 3;
}

function artefactPriority(_artefact: GranolaAutomationArtefact): number {
  return 2;
}

export function buildGranolaReviewInbox(options: {
  artefacts: GranolaAutomationArtefact[];
  issues: GranolaProcessingIssue[];
  runs: GranolaAutomationActionRun[];
}): GranolaReviewInboxItem[] {
  const items: GranolaReviewInboxItem[] = [];

  for (const issue of options.issues) {
    items.push({
      issue,
      key: `issue:${issue.id}`,
      kind: "issue",
      meetingId: issue.meetingId,
      priority: issuePriority(issue),
      status: issue.severity,
      subtitle: issue.kind,
      summary: issue.detail,
      timestamp: issue.detectedAt,
      title: issue.title,
    });
  }

  for (const artefact of options.artefacts) {
    if (artefact.status !== "generated") {
      continue;
    }

    items.push({
      artefact,
      key: `artefact:${artefact.id}`,
      kind: "artefact",
      meetingId: artefact.meetingId,
      priority: artefactPriority(artefact),
      status: artefact.status,
      subtitle: `${artefact.kind} • ${artefact.ruleName}`,
      summary:
        artefact.structured.summary || artefact.structured.markdown || artefact.structured.title,
      timestamp: artefact.updatedAt,
      title: artefact.structured.title,
    });
  }

  for (const run of options.runs) {
    if (run.status !== "pending") {
      continue;
    }

    items.push({
      key: `run:${run.id}`,
      kind: "run",
      meetingId: run.meetingId,
      priority: runPriority(run),
      run,
      status: run.status,
      subtitle: `${run.actionName} • ${run.ruleName}`,
      summary: run.prompt || run.result || run.error || run.eventKind,
      timestamp: run.startedAt,
      title: run.title,
    });
  }

  return items.sort(
    (left, right) =>
      left.priority - right.priority ||
      right.timestamp.localeCompare(left.timestamp) ||
      left.title.localeCompare(right.title) ||
      left.key.localeCompare(right.key),
  );
}

export function summariseGranolaReviewInbox(
  items: GranolaReviewInboxItem[],
): GranolaReviewInboxSummary {
  return items.reduce<GranolaReviewInboxSummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.kind === "artefact") {
        summary.artefacts += 1;
      } else if (item.kind === "issue") {
        summary.issues += 1;
      } else {
        summary.runs += 1;
      }
      return summary;
    },
    {
      artefacts: 0,
      issues: 0,
      runs: 0,
      total: 0,
    },
  );
}
