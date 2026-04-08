import { listGranolaIntelligencePresets } from "../intelligence-presets.ts";
import { toJson, toYaml } from "../render.ts";
import type { GranolaAgentProviderKind } from "../types.ts";

import { createCommandAppContext } from "./shared.ts";
import type { CommandDefinition } from "./types.ts";

type IntelligenceFormat = "json" | "text" | "yaml";

function intelligenceHelp(): string {
  return `Gran intelligence

Usage:
  gran intelligence <list|run> [preset] [options]

Subcommands:
  list                       Show built-in intelligence presets
  run <preset>               Run one preset over recent meetings and save reviewable artefacts

Presets:
  people
  companies
  action-items
  decisions
  insights

Options:
  --format <value>           text, json, yaml (default: text)
  --last <n>                 Number of recent meetings to inspect (default: 5)
  --days <n>                 Only include meetings updated in the last N days
  --folder <query>           Limit the run to one folder id or name
  --provider <value>         codex, openai, openrouter
  --model <value>            Override the default model
  --approve                  Auto-approve generated artefacts
  --cache <path>             Path to Granola desktop transcript file
  --supabase <path>          Path to supabase.json
  --debug                    Enable debug logging
  --config <path>            Path to .gran.json
  -h, --help                 Show help
`;
}

function resolveFormat(value: string | boolean | undefined): IntelligenceFormat {
  switch (value) {
    case undefined:
      return "text";
    case "json":
    case "text":
    case "yaml":
      return value;
    default:
      throw new Error("invalid intelligence format: expected text, json, or yaml");
  }
}

function parseLimit(value: string | boolean | undefined): number {
  if (value === undefined) {
    return 5;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    throw new Error("invalid --last value: expected a positive integer");
  }

  const limit = Number(value.trim());
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("invalid --last value: expected a positive integer");
  }

  return limit;
}

function parseDays(value: string | boolean | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    throw new Error("invalid --days value: expected a positive integer");
  }

  const days = Number(value.trim());
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error("invalid --days value: expected a positive integer");
  }

  return days;
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

function updatedFromDate(days: number | undefined): string | undefined {
  if (!days) {
    return undefined;
  }

  const value = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return value.toISOString();
}

function renderPresetList(format: IntelligenceFormat): string {
  const presets = listGranolaIntelligencePresets();
  if (format === "json") {
    return toJson({ presets });
  }

  if (format === "yaml") {
    return toYaml({ presets });
  }

  return `${presets.map((preset) => `- ${preset.id}: ${preset.description}`).join("\n")}\n`;
}

function renderRunResult(
  result: Awaited<ReturnType<import("../app/core.ts").GranolaApp["runIntelligencePreset"]>>,
  format: IntelligenceFormat,
): string {
  if (format === "json") {
    return toJson(result);
  }

  if (format === "yaml") {
    return toYaml(result);
  }

  const lines = [
    `Preset: ${result.preset.label}`,
    `Meetings: ${result.meetings.length}`,
    `Runs: ${result.runs.length}`,
    `Artefacts: ${result.artefacts.length}`,
    "",
  ];

  if (result.artefacts.length === 0) {
    lines.push("No artefacts were generated.");
  } else {
    for (const artefact of result.artefacts) {
      lines.push(
        `- ${artefact.structured.title} (${artefact.status})`,
        `  meeting: ${artefact.meetingId}`,
        `  rule: ${artefact.ruleName}`,
        `  summary: ${artefact.structured.summary || "No summary"}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export const intelligenceCommand: CommandDefinition = {
  description: "Run built-in meeting intelligence presets",
  flags: {
    approve: { type: "boolean" },
    cache: { type: "string" },
    days: { type: "string" },
    folder: { type: "string" },
    format: { type: "string" },
    help: { type: "boolean" },
    last: { type: "string" },
    model: { type: "string" },
    provider: { type: "string" },
  },
  help: intelligenceHelp,
  name: "intelligence",
  async run({ commandArgs, commandFlags, globalFlags }) {
    const subcommand = commandArgs[0] ?? "list";
    const format = resolveFormat(commandFlags.format);

    if (subcommand === "list") {
      console.log(renderPresetList(format));
      return 0;
    }

    if (subcommand !== "run") {
      throw new Error("invalid intelligence command: expected list or run");
    }

    const presetId = commandArgs[1];
    if (!presetId) {
      throw new Error("intelligence run requires a preset id");
    }

    const { app } = await createCommandAppContext(commandFlags, globalFlags, {
      includeCacheFile: true,
      includeSupabase: true,
      includeTimeoutMs: true,
    });
    const folderQuery = typeof commandFlags.folder === "string" ? commandFlags.folder : undefined;
    const folder = folderQuery ? await app.findFolder(folderQuery) : undefined;
    const result = await app.runIntelligencePreset(presetId, {
      approvalMode: commandFlags.approve === true ? "auto" : "manual",
      folderId: folder?.id,
      limit: parseLimit(commandFlags.last),
      model: typeof commandFlags.model === "string" ? commandFlags.model : undefined,
      provider: parseProvider(commandFlags.provider),
      updatedFrom: updatedFromDate(parseDays(commandFlags.days)),
    });

    console.log(renderRunResult(result, format));
    return 0;
  },
};
