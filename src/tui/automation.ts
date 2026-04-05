import {
  type Component,
  type Focusable,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";

import type {
  GranolaAutomationActionRun,
  GranolaAutomationArtefact,
  GranolaProcessingIssue,
} from "../app/index.ts";

import { granolaTuiTheme } from "./theme.ts";

interface GranolaTuiAutomationOverlayOptions {
  artefacts: GranolaAutomationArtefact[];
  issues: GranolaProcessingIssue[];
  onApproveArtefact: (id: string) => Promise<void> | void;
  onApproveRun: (id: string) => Promise<void> | void;
  onCancel: () => void;
  onRejectArtefact: (id: string) => Promise<void> | void;
  onRejectRun: (id: string) => Promise<void> | void;
  onRecoverIssue: (id: string) => Promise<void> | void;
  onRerunArtefact: (id: string) => Promise<void> | void;
  runs: GranolaAutomationActionRun[];
}

type GranolaTuiAutomationOverlayItem =
  | {
      issue: GranolaProcessingIssue;
      kind: "issue";
    }
  | {
      artefact: GranolaAutomationArtefact;
      kind: "artefact";
    }
  | {
      kind: "run";
      run: GranolaAutomationActionRun;
    };

function padLine(text: string, width: number): string {
  const clipped = truncateToWidth(text, width, "");
  return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

function frameLine(text: string, width: number): string {
  const innerWidth = Math.max(1, width - 4);
  return `| ${padLine(text, innerWidth)} |`;
}

function wrapDetails(text: string, width: number): string[] {
  return wrapTextWithAnsi(text, Math.max(1, width - 4));
}

function statusLabel(run: GranolaAutomationActionRun): string {
  switch (run.status) {
    case "completed":
      return granolaTuiTheme.info(run.status);
    case "failed":
      return granolaTuiTheme.error(run.status);
    case "pending":
      return granolaTuiTheme.warning(run.status);
    case "skipped":
    default:
      return granolaTuiTheme.dim(run.status);
  }
}

function artefactStatusLabel(artefact: GranolaAutomationArtefact): string {
  switch (artefact.status) {
    case "approved":
      return granolaTuiTheme.info(artefact.status);
    case "generated":
      return granolaTuiTheme.warning(artefact.status);
    case "rejected":
      return granolaTuiTheme.error(artefact.status);
    case "superseded":
    default:
      return granolaTuiTheme.dim(artefact.status);
  }
}

function issueSeverityLabel(issue: GranolaProcessingIssue): string {
  return issue.severity === "error"
    ? granolaTuiTheme.error(issue.severity)
    : granolaTuiTheme.warning(issue.severity);
}

export class GranolaTuiAutomationOverlay implements Component, Focusable {
  focused = false;
  #selectedIndex = 0;

  constructor(private readonly options: GranolaTuiAutomationOverlayOptions) {}

  invalidate(): void {}

  private get items(): GranolaTuiAutomationOverlayItem[] {
    return [
      ...this.options.issues.map((issue) => ({
        issue,
        kind: "issue" as const,
      })),
      ...this.options.artefacts.map((artefact) => ({
        artefact,
        kind: "artefact" as const,
      })),
      ...this.options.runs.map((run) => ({
        kind: "run" as const,
        run,
      })),
    ];
  }

  private get selected(): GranolaTuiAutomationOverlayItem | undefined {
    return this.items[this.#selectedIndex];
  }

  handleInput(data: string): void {
    if (matchesKey(data, "esc")) {
      this.options.onCancel();
      return;
    }

    if (matchesKey(data, "up")) {
      this.#selectedIndex = Math.max(0, this.#selectedIndex - 1);
      return;
    }

    if (matchesKey(data, "down")) {
      if (this.items.length === 0) {
        return;
      }
      this.#selectedIndex = Math.min(this.items.length - 1, this.#selectedIndex + 1);
      return;
    }

    if (matchesKey(data, "enter") || matchesKey(data, "a")) {
      if (this.selected?.kind === "issue" && this.selected.issue.recoverable) {
        void this.options.onRecoverIssue(this.selected.issue.id);
      }
      if (this.selected?.kind === "run" && this.selected.run.status === "pending") {
        void this.options.onApproveRun(this.selected.run.id);
      }
      if (this.selected?.kind === "artefact" && this.selected.artefact.status !== "superseded") {
        void this.options.onApproveArtefact(this.selected.artefact.id);
      }
      return;
    }

    if (matchesKey(data, "r")) {
      if (this.selected?.kind === "run" && this.selected.run.status === "pending") {
        void this.options.onRejectRun(this.selected.run.id);
        return;
      }
      if (this.selected?.kind === "artefact" && this.selected.artefact.status !== "superseded") {
        void this.options.onRejectArtefact(this.selected.artefact.id);
      }
      return;
    }

    if (matchesKey(data, "e")) {
      if (this.selected?.kind === "artefact") {
        void this.options.onRerunArtefact(this.selected.artefact.id);
      }
    }
  }

  render(width: number): string[] {
    const bodyWidth = Math.max(56, width);
    const innerWidth = Math.max(1, bodyWidth - 4);
    const maxRuns = 6;
    const lines: string[] = [];

    lines.push(`+${"-".repeat(bodyWidth - 2)}+`);
    lines.push(frameLine(granolaTuiTheme.strong("Automation Review"), bodyWidth));
    lines.push(frameLine("Enter/a approve  r reject  e rerun artefact  Esc close", bodyWidth));
    lines.push(frameLine("", bodyWidth));

    if (this.items.length === 0) {
      lines.push(frameLine(granolaTuiTheme.dim("No automation review items yet."), bodyWidth));
    } else {
      for (const [index, item] of this.items.slice(0, maxRuns).entries()) {
        const selected = index === this.#selectedIndex;
        const title =
          item.kind === "issue"
            ? `${selected ? ">" : " "} ${item.issue.title} · ${issueSeverityLabel(item.issue)}`
            : item.kind === "artefact"
              ? `${selected ? ">" : " "} ${item.artefact.structured.title} · ${artefactStatusLabel(item.artefact)}`
              : `${selected ? ">" : " "} ${item.run.actionName} · ${statusLabel(item.run)}`;
        lines.push(frameLine(selected ? granolaTuiTheme.selected(title) : title, bodyWidth));
        lines.push(
          frameLine(
            item.kind === "issue"
              ? `  ${item.issue.kind} · ${item.issue.meetingId ?? "global"}`
              : item.kind === "artefact"
                ? `  ${item.artefact.ruleName} · ${item.artefact.meetingId}`
                : `  ${item.run.ruleName} · ${item.run.title}`,
            bodyWidth,
          ),
        );

        const details =
          item.kind === "issue"
            ? item.issue.detail
            : item.kind === "artefact"
              ? item.artefact.structured.summary ||
                item.artefact.structured.markdown ||
                item.artefact.id
              : item.run.prompt || item.run.result || item.run.error || item.run.eventKind;
        for (const line of wrapDetails(`  ${details}`, innerWidth).slice(0, 2)) {
          lines.push(frameLine(line, bodyWidth));
        }

        lines.push(frameLine("", bodyWidth));
      }
    }

    lines.push(
      frameLine(
        granolaTuiTheme.dim("Health issues are listed before artefacts and pending ask-user runs."),
        bodyWidth,
      ),
    );
    lines.push(`+${"-".repeat(bodyWidth - 2)}+`);
    return lines;
  }
}
