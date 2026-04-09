import { basename } from "node:path";

import { type GranolaExportTarget, type GranolaExportTargetKind } from "../app/index.ts";
import { parseGranolaExportTargetKind } from "../export-target-registry.ts";
import { toJson, toYaml } from "../render.ts";

import { createCommandAppContext } from "./shared.ts";
import type { CommandDefinition } from "./types.ts";

type TargetsFormat = "json" | "text" | "yaml";

function targetsHelp(): string {
  const kinds = ["obsidian-vault", "folder"].join(" or ");
  return `Gran kb

Usage:
  gran kb [list|add|remove] [options]

Subcommands:
  list                Show configured knowledge bases
  add                 Create or replace one knowledge base
  remove <id|name>    Remove one knowledge base

Options:
  --format <value>           text, json, yaml (default: text)
  --id <value>               Optional internal id for add/remove
  --name <value>             Human label for the knowledge base
  --kind <value>             ${kinds} (default: folder)
  --output <path>            Root folder or vault path
  --path <path>              Alias for --output
  --notes-subdir <path>      Notes subdirectory inside the knowledge base
  --transcripts-subdir <path>
                            Transcript subdirectory inside the knowledge base
  --notes-format <value>     markdown, json, yaml, raw
  --transcripts-format <value>
                            text, markdown, json, yaml, raw
  --daily-notes-dir <path>   Optional daily note directory for Obsidian vaults
  --config <path>            Path to JSON config file
  --debug                    Enable debug logging
  -h, --help                 Show help
`;
}

function resolveFormat(value: string | boolean | undefined): TargetsFormat {
  switch (value) {
    case undefined:
      return "text";
    case "json":
    case "text":
    case "yaml":
      return value;
    default:
      throw new Error("invalid targets format: expected text, json, or yaml");
  }
}

function resolveKind(value: string | boolean | undefined): GranolaExportTargetKind {
  if (value === undefined) {
    return "bundle-folder";
  }

  if (value === "folder") {
    return "bundle-folder";
  }

  const kind = parseGranolaExportTargetKind(value);
  if (!kind) {
    throw new Error("invalid knowledge base kind: expected obsidian-vault or folder");
  }

  return kind;
}

function resolveNotesFormat(
  value: string | boolean | undefined,
): GranolaExportTarget["notesFormat"] {
  switch (value) {
    case undefined:
      return undefined;
    case "json":
    case "markdown":
    case "raw":
    case "yaml":
      return value;
    default:
      throw new Error("invalid notes format: expected markdown, json, yaml, or raw");
  }
}

function resolveTranscriptsFormat(
  value: string | boolean | undefined,
): GranolaExportTarget["transcriptsFormat"] {
  switch (value) {
    case undefined:
      return undefined;
    case "json":
    case "markdown":
    case "raw":
    case "text":
    case "yaml":
      return value;
    default:
      throw new Error("invalid transcripts format: expected text, markdown, json, yaml, or raw");
  }
}

function renderTargets(targets: GranolaExportTarget[], format: TargetsFormat): string {
  if (format === "json") {
    return toJson({ targets });
  }

  if (format === "yaml") {
    return toYaml({ targets });
  }

  if (targets.length === 0) {
    return "No knowledge bases configured\n";
  }

  const header = "NAME                   KIND             LOCATION";
  const lines = targets.map((target) => {
    const name = (target.name ?? target.id).padEnd(22).slice(0, 22);
    const kind = target.kind === "obsidian-vault" ? "obsidian-vault" : "folder";
    return `${name} ${kind.padEnd(16).slice(0, 16)} ${target.outputDir}`;
  });

  return `${[header, ...lines].join("\n")}\n`;
}

function slugifyKnowledgeBaseId(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "knowledge-base";
}

function pickKnowledgeBaseIdentifier(
  commandArgs: string[],
  commandFlags: Record<string, string | boolean | undefined>,
): string {
  const id = typeof commandFlags.id === "string" ? commandFlags.id : commandArgs[1];
  if (!id?.trim()) {
    throw new Error("knowledge base id or name is required");
  }

  return id.trim();
}

function buildTargetFromFlags(
  commandFlags: Record<string, string | boolean | undefined>,
): GranolaExportTarget {
  const outputDir =
    typeof commandFlags.output === "string"
      ? commandFlags.output.trim()
      : typeof commandFlags.path === "string"
        ? commandFlags.path.trim()
        : "";
  const name =
    typeof commandFlags.name === "string" && commandFlags.name.trim()
      ? commandFlags.name.trim()
      : undefined;
  const explicitId = typeof commandFlags.id === "string" ? commandFlags.id.trim() : "";
  if (!outputDir) {
    throw new Error("knowledge base output directory is required");
  }
  const generatedId = slugifyKnowledgeBaseId(name || basename(outputDir));
  const kind = resolveKind(commandFlags.kind);

  return {
    dailyNotesDir:
      typeof commandFlags["daily-notes-dir"] === "string" && commandFlags["daily-notes-dir"].trim()
        ? commandFlags["daily-notes-dir"].trim()
        : undefined,
    id: explicitId || generatedId,
    kind,
    name,
    notesFormat: resolveNotesFormat(commandFlags["notes-format"]),
    notesSubdir:
      typeof commandFlags["notes-subdir"] === "string" && commandFlags["notes-subdir"].trim()
        ? commandFlags["notes-subdir"].trim()
        : undefined,
    outputDir,
    transcriptsFormat: resolveTranscriptsFormat(commandFlags["transcripts-format"]),
    transcriptsSubdir:
      typeof commandFlags["transcripts-subdir"] === "string" &&
      commandFlags["transcripts-subdir"].trim()
        ? commandFlags["transcripts-subdir"].trim()
        : undefined,
  };
}

export const targetsCommand: CommandDefinition = {
  aliases: ["targets"],
  description: "Manage knowledge base destinations",
  flags: {
    "daily-notes-dir": { type: "string" },
    format: { type: "string" },
    help: { type: "boolean" },
    id: { type: "string" },
    kind: { type: "string" },
    name: { type: "string" },
    "notes-format": { type: "string" },
    "notes-subdir": { type: "string" },
    output: { type: "string" },
    path: { type: "string" },
    "transcripts-format": { type: "string" },
    "transcripts-subdir": { type: "string" },
  },
  help: targetsHelp,
  name: "kb",
  async run({ commandArgs, commandFlags, globalFlags }) {
    const subcommand = commandArgs[0] ?? "list";
    const { app } = await createCommandAppContext(commandFlags, globalFlags);

    switch (subcommand) {
      case "list": {
        const format = resolveFormat(commandFlags.format);
        const result = await app.listExportTargets();
        console.log(renderTargets(result.targets, format));
        return 0;
      }
      case "add": {
        const knowledgeBase = buildTargetFromFlags(commandFlags);
        const existing = (await app.listExportTargets()).targets;
        const nextTargets = [
          knowledgeBase,
          ...existing.filter((candidate) => candidate.id !== knowledgeBase.id),
        ].sort((left, right) => left.id.localeCompare(right.id));
        const result = await app.saveExportTargets(nextTargets);
        console.log(
          `Saved knowledge base ${knowledgeBase.name ?? knowledgeBase.id} -> ${knowledgeBase.outputDir} (${result.targets.length} total)`,
        );
        return 0;
      }
      case "remove": {
        const existing = (await app.listExportTargets()).targets;
        const identifier = pickKnowledgeBaseIdentifier(commandArgs, commandFlags);
        const match = existing.find(
          (candidate) => candidate.id === identifier || candidate.name === identifier,
        );
        if (!match) {
          throw new Error(`knowledge base not found: ${identifier}`);
        }
        const nextTargets = existing.filter((candidate) => candidate.id !== match.id);
        if (nextTargets.length === existing.length) {
          throw new Error(`knowledge base not found: ${identifier}`);
        }
        await app.saveExportTargets(nextTargets);
        console.log(`Removed knowledge base ${match.name ?? match.id}`);
        return 0;
      }
      default:
        throw new Error("invalid kb command: expected list, add, or remove");
    }
  },
};
