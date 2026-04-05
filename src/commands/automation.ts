import {
  createGranolaApp,
  type GranolaAutomationArtefact,
  type GranolaAutomationEvaluationResult,
  type GranolaAutomationActionRun,
  type GranolaAutomationMatch,
  type GranolaAutomationRule,
  type GranolaProcessingIssue,
} from "../app/index.ts";
import { loadConfig } from "../config.ts";
import { readAutomationEvaluationCases } from "../evaluations.ts";
import { toJson, toYaml } from "../render.ts";
import type { GranolaAgentProviderKind } from "../types.ts";

import { debug } from "./shared.ts";
import type { CommandDefinition } from "./types.ts";

type AutomationFormat = "json" | "text" | "yaml";

function automationHelp(): string {
  return `Granola automation

Usage:
  granola automation <rules|matches|runs|artefacts|health|evaluate|recover|approve|reject|approve-artefact|reject-artefact|rerun> [options]

Subcommands:
  rules               List configured automation rules
  matches             Show recent rule matches from sync events
  runs                Show recent automation action runs
  artefacts           Show generated note and enrichment artefacts
  health              Show processing-health issues and recovery candidates
  evaluate            Run fixture-backed harness evaluations
  recover <issue-id>  Recover a processing-health issue
  approve <id>        Approve a pending ask-user action run
  reject <id>         Reject a pending ask-user action run
  approve-artefact <id>
                      Approve a generated automation artefact
  reject-artefact <id>
                      Reject a generated automation artefact
  rerun <id>          Re-run the pipeline that produced an artefact

Options:
  --format <value>    text, json, yaml (default: text)
  --limit <n>         Number of matches to show (default: 20)
  --kind <value>      notes or enrichment
  --fixture <path>    Evaluation fixture file or directory
  --harness <value>   Harness id or comma-separated ids for evaluation
  --provider <value>  codex, openai, openrouter
  --model <value>     Override the harness model for evaluation
  --meeting <id>      Filter artefacts to one meeting id
  --severity <value>  error or warning
  --status <value>    completed, failed, pending, skipped
  --note <text>       Note to store with approve/reject decisions
  --rules <path>      Path to automation rules JSON
  --timeout <value>   Request timeout, e.g. 2m, 30s, 120000 (default: 2m)
  --supabase <path>   Path to supabase.json
  --debug             Enable debug logging
  --config <path>     Path to .granola.toml
  -h, --help          Show help
`;
}

function resolveFormat(value: string | boolean | undefined): AutomationFormat {
  switch (value) {
    case undefined:
      return "text";
    case "json":
    case "text":
    case "yaml":
      return value;
    default:
      throw new Error("invalid automation format: expected text, json, or yaml");
  }
}

function parseLimit(value: string | boolean | undefined): number {
  if (value === undefined) {
    return 20;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("invalid automation limit: expected a positive integer");
  }

  return Number(value);
}

function renderRules(rules: GranolaAutomationRule[], format: AutomationFormat): string {
  if (format === "json") {
    return toJson({ rules });
  }

  if (format === "yaml") {
    return toYaml({ rules });
  }

  if (rules.length === 0) {
    return "No automation rules configured\n";
  }

  const header = "ID                      ENABLED  EVENTS                 ACTIONS  FILTERS";
  const lines = rules.map((rule) => {
    const filters = [
      rule.when.folderIds?.length ? `folderIds=${rule.when.folderIds.join(",")}` : "",
      rule.when.folderNames?.length ? `folderNames=${rule.when.folderNames.join(",")}` : "",
      rule.when.tags?.length ? `tags=${rule.when.tags.join(",")}` : "",
      rule.when.titleIncludes?.length ? `title~=${rule.when.titleIncludes.join(",")}` : "",
      rule.when.transcriptLoaded === true ? "transcriptLoaded=true" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `${rule.id.padEnd(23).slice(0, 23)} ${(rule.enabled === false ? "no" : "yes").padEnd(8)} ${(rule.when.eventKinds?.join(",") || "any").padEnd(22).slice(0, 22)} ${String(rule.actions?.length ?? 0).padEnd(8)} ${filters || "-"}`;
  });

  return `${[header, ...lines].join("\n")}\n`;
}

function renderMatches(matches: GranolaAutomationMatch[], format: AutomationFormat): string {
  if (format === "json") {
    return toJson({ matches });
  }

  if (format === "yaml") {
    return toYaml({ matches });
  }

  if (matches.length === 0) {
    return "No automation matches yet\n";
  }

  const header = "MATCHED AT            RULE                    EVENT               TITLE";
  const lines = matches.map((match) => {
    const matchedAt = match.matchedAt.slice(0, 19).padEnd(21);
    const ruleName = match.ruleName.padEnd(23).slice(0, 23);
    const eventKind = match.eventKind.padEnd(18).slice(0, 18);
    return `${matchedAt} ${ruleName} ${eventKind} ${match.title} (${match.meetingId})`;
  });

  return `${[header, ...lines].join("\n")}\n`;
}

function parseRunStatus(
  value: string | boolean | undefined,
): GranolaAutomationActionRun["status"] | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "completed":
    case "failed":
    case "pending":
    case "skipped":
      return value;
    default:
      throw new Error("invalid automation status: expected completed, failed, pending, or skipped");
  }
}

function parseArtefactKind(
  value: string | boolean | undefined,
): GranolaAutomationArtefact["kind"] | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "enrichment":
    case "notes":
      return value;
    default:
      throw new Error("invalid automation artefact kind: expected notes or enrichment");
  }
}

function parseHarnessIds(value: string | boolean | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("invalid harness list: expected a comma-separated string");
  }

  const ids = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

function parseProvider(value: string | boolean | undefined): GranolaAgentProviderKind | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "codex":
    case "openai":
    case "openrouter":
      return value;
    default:
      throw new Error("invalid provider: expected codex, openai, or openrouter");
  }
}

function parseArtefactStatus(
  value: string | boolean | undefined,
): GranolaAutomationArtefact["status"] | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "approved":
    case "generated":
    case "rejected":
    case "superseded":
      return value;
    default:
      throw new Error(
        "invalid automation artefact status: expected approved, generated, rejected, or superseded",
      );
  }
}

function renderArtefacts(artefacts: GranolaAutomationArtefact[], format: AutomationFormat): string {
  if (format === "json") {
    return toJson({ artefacts });
  }

  if (format === "yaml") {
    return toYaml({ artefacts });
  }

  if (artefacts.length === 0) {
    return "No automation artefacts yet\n";
  }

  const header = "UPDATED AT            STATUS       KIND         TITLE";
  const lines = artefacts.map((artefact) => {
    const updatedAt = artefact.updatedAt.slice(0, 19).padEnd(21);
    const status = artefact.status.padEnd(12).slice(0, 12);
    const kind = artefact.kind.padEnd(12).slice(0, 12);
    const tail = [artefact.structured.title, artefact.structured.summary || artefact.id]
      .filter(Boolean)
      .join(" - ");
    return `${updatedAt} ${status} ${kind} ${tail}`;
  });

  return `${[header, ...lines].join("\n")}\n`;
}

function renderEvaluations(
  result: GranolaAutomationEvaluationResult,
  format: AutomationFormat,
): string {
  if (format === "json") {
    return toJson(result);
  }

  if (format === "yaml") {
    return toYaml(result);
  }

  if (result.results.length === 0) {
    return "No evaluation results\n";
  }

  const header =
    "CASE                 HARNESS              STATUS      PROVIDER/MODEL                  SUMMARY";
  const lines = result.results.map((entry) => {
    const harness = (entry.harnessName || entry.harnessId || "-").padEnd(20).slice(0, 20);
    const status = entry.status.padEnd(11).slice(0, 11);
    const providerModel = `${entry.provider || "-"}${entry.model ? `/${entry.model}` : ""}`
      .padEnd(30)
      .slice(0, 30);
    const summary =
      entry.status === "failed"
        ? entry.error || "Evaluation failed"
        : [
            entry.structured?.title,
            entry.structured?.summary,
            entry.structured?.actionItems.length
              ? `${entry.structured.actionItems.length} action item(s)`
              : "",
          ]
            .filter(Boolean)
            .join(" - ");
    return `${entry.caseTitle.padEnd(20).slice(0, 20)} ${harness} ${status} ${providerModel} ${summary}`;
  });

  return (
    [
      `Evaluated ${result.results.length} run(s) across ${new Set(result.results.map((entry) => entry.caseId)).size} case(s)`,
      `Kind: ${result.kind}`,
      "",
      header,
      ...lines,
    ].join("\n") + "\n"
  );
}

function parseSeverity(
  value: string | boolean | undefined,
): GranolaProcessingIssue["severity"] | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "error":
    case "warning":
      return value;
    default:
      throw new Error("invalid processing severity: expected error or warning");
  }
}

function renderProcessingIssues(
  issues: GranolaProcessingIssue[],
  format: AutomationFormat,
): string {
  if (format === "json") {
    return toJson({ issues });
  }

  if (format === "yaml") {
    return toYaml({ issues });
  }

  if (issues.length === 0) {
    return "No processing issues detected\n";
  }

  const header = "SEVERITY  KIND                 TITLE";
  const lines = issues.map((issue) => {
    const severity = issue.severity.padEnd(9).slice(0, 9);
    const kind = issue.kind.padEnd(20).slice(0, 20);
    const tail = [issue.title, issue.detail].filter(Boolean).join(" - ");
    return `${severity} ${kind} ${tail}`;
  });

  return `${[header, ...lines].join("\n")}\n`;
}

function renderRuns(runs: GranolaAutomationActionRun[], format: AutomationFormat): string {
  if (format === "json") {
    return toJson({ runs });
  }

  if (format === "yaml") {
    return toYaml({ runs });
  }

  if (runs.length === 0) {
    return "No automation runs yet\n";
  }

  const header =
    "STARTED AT            STATUS      ACTION                  RULE                    TITLE";
  const lines = runs.map((run) => {
    const startedAt = run.startedAt.slice(0, 19).padEnd(21);
    const status = run.status.padEnd(11).slice(0, 11);
    const actionName = run.actionName.padEnd(23).slice(0, 23);
    const ruleName = run.ruleName.padEnd(23).slice(0, 23);
    const tail = [run.title, run.result || run.error].filter(Boolean).join(" - ");
    return `${startedAt} ${status} ${actionName} ${ruleName} ${tail}`;
  });

  return `${[header, ...lines].join("\n")}\n`;
}

export const automationCommand: CommandDefinition = {
  description: "Inspect automation rules and rule matches",
  flags: {
    fixture: { type: "string" },
    format: { type: "string" },
    harness: { type: "string" },
    help: { type: "boolean" },
    kind: { type: "string" },
    limit: { type: "string" },
    meeting: { type: "string" },
    model: { type: "string" },
    note: { type: "string" },
    provider: { type: "string" },
    severity: { type: "string" },
    status: { type: "string" },
    timeout: { type: "string" },
  },
  help: automationHelp,
  name: "automation",
  async run({ commandArgs, commandFlags, globalFlags }) {
    const [action] = commandArgs;
    const format = resolveFormat(commandFlags.format);
    const config = await loadConfig({
      globalFlags,
      subcommandFlags: commandFlags,
    });

    debug(config.debug, "using config", config.configFileUsed ?? "(none)");
    debug(config.debug, "automationRules", config.automation?.rulesFile ?? "(default)");

    const app = await createGranolaApp(config);

    switch (action) {
      case "rules": {
        const result = await app.listAutomationRules();
        console.log(renderRules(result.rules, format).trimEnd());
        return 0;
      }
      case "matches": {
        const result = await app.listAutomationMatches({ limit: parseLimit(commandFlags.limit) });
        console.log(renderMatches(result.matches, format).trimEnd());
        return 0;
      }
      case "runs": {
        const result = await app.listAutomationRuns({
          limit: parseLimit(commandFlags.limit),
          status: parseRunStatus(commandFlags.status),
        });
        console.log(renderRuns(result.runs, format).trimEnd());
        return 0;
      }
      case "artefacts": {
        const result = await app.listAutomationArtefacts({
          kind: parseArtefactKind(commandFlags.kind),
          limit: parseLimit(commandFlags.limit),
          meetingId:
            typeof commandFlags.meeting === "string" ? commandFlags.meeting.trim() : undefined,
          status: parseArtefactStatus(commandFlags.status),
        });
        console.log(renderArtefacts(result.artefacts, format).trimEnd());
        return 0;
      }
      case "health": {
        const result = await app.listProcessingIssues({
          limit: parseLimit(commandFlags.limit),
          meetingId:
            typeof commandFlags.meeting === "string" ? commandFlags.meeting.trim() : undefined,
          severity: parseSeverity(commandFlags.severity),
        });
        console.log(renderProcessingIssues(result.issues, format).trimEnd());
        return 0;
      }
      case "evaluate": {
        const fixturePath =
          typeof commandFlags.fixture === "string" ? commandFlags.fixture.trim() : "";
        if (!fixturePath) {
          throw new Error("automation evaluate requires --fixture <path>");
        }

        const result = await app.evaluateAutomationCases(
          await readAutomationEvaluationCases(fixturePath),
          {
            harnessIds: parseHarnessIds(commandFlags.harness),
            kind: parseArtefactKind(commandFlags.kind) ?? "notes",
            model: typeof commandFlags.model === "string" ? commandFlags.model.trim() : undefined,
            provider: parseProvider(commandFlags.provider),
          },
        );
        console.log(renderEvaluations(result, format).trimEnd());
        return 0;
      }
      case "recover": {
        const id = commandArgs[1]?.trim();
        if (!id) {
          throw new Error("missing processing issue id for recover");
        }

        const result = await app.recoverProcessingIssue(id);
        console.log(
          `Recovered ${result.issue.kind} for ${result.issue.title} (${result.issue.id})`,
        );
        return 0;
      }
      case "approve":
      case "reject": {
        const id = commandArgs[1]?.trim();
        if (!id) {
          throw new Error(`missing automation run id for ${action}`);
        }

        const run = await app.resolveAutomationRun(id, action, {
          note: typeof commandFlags.note === "string" ? commandFlags.note : undefined,
        });
        console.log(
          `${action === "approve" ? "Approved" : "Rejected"} ${run.actionName} for ${run.title} (${run.id})`,
        );
        return 0;
      }
      case "approve-artefact":
      case "reject-artefact": {
        const id = commandArgs[1]?.trim();
        if (!id) {
          throw new Error(`missing automation artefact id for ${action}`);
        }

        const artefact = await app.resolveAutomationArtefact(
          id,
          action === "approve-artefact" ? "approve" : "reject",
          {
            note: typeof commandFlags.note === "string" ? commandFlags.note : undefined,
          },
        );
        console.log(
          `${action === "approve-artefact" ? "Approved" : "Rejected"} artefact ${artefact.structured.title} (${artefact.id})`,
        );
        return 0;
      }
      case "rerun": {
        const id = commandArgs[1]?.trim();
        if (!id) {
          throw new Error("missing automation artefact id for rerun");
        }

        const artefact = await app.rerunAutomationArtefact(id);
        console.log(
          `Re-ran ${artefact.kind} pipeline for ${artefact.structured.title} (${artefact.id})`,
        );
        return 0;
      }
      case undefined:
        console.log(automationHelp());
        return 1;
      default:
        throw new Error(
          "invalid automation command: expected rules, matches, runs, artefacts, health, evaluate, recover, approve, reject, approve-artefact, reject-artefact, or rerun",
        );
    }
  },
};
