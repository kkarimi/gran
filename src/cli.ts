import { readFile } from "node:fs/promises";

import { fetchDocuments } from "./api.ts";
import { parseCacheContents } from "./cache.ts";
import { loadConfig, type FlagValues } from "./config.ts";
import { writeNotes } from "./notes.ts";
import { writeTranscripts } from "./transcripts.ts";
import { granolaCacheCandidates, granolaSupabaseCandidates } from "./utils.ts";

type FlagType = "boolean" | "string";

interface ParseSpec {
  type: FlagType;
}

function parseBooleanValue(value: string): boolean {
  if (/^(true|1|yes|on)$/i.test(value)) {
    return true;
  }

  if (/^(false|0|no|off)$/i.test(value)) {
    return false;
  }

  throw new Error(`invalid boolean value: ${value}`);
}

function parseFlags(
  args: string[],
  spec: Record<string, ParseSpec>,
): { rest: string[]; values: FlagValues } {
  const values: FlagValues = {};
  const rest: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;

    if (token === "--") {
      rest.push(...args.slice(index + 1));
      break;
    }

    if (token === "-h") {
      values.help = true;
      continue;
    }

    if (!token.startsWith("--")) {
      rest.push(token);
      continue;
    }

    const [rawName = "", inlineValue] = token.slice(2).split("=", 2);
    const name = rawName as keyof typeof spec;
    const definition = spec[name];

    if (!definition) {
      rest.push(token);
      continue;
    }

    if (definition.type === "boolean") {
      values[name] = inlineValue == null ? true : parseBooleanValue(inlineValue);
      continue;
    }

    if (inlineValue != null) {
      values[name] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (next == null || next.startsWith("--")) {
      throw new Error(`missing value for --${name}`);
    }

    values[name] = next;
    index += 1;
  }

  return { rest, values };
}

function splitCommand(argv: string[]): { command?: string; rest: string[] } {
  const commands = new Set(["notes", "transcripts"]);
  const rest: string[] = [];
  let command: string | undefined;

  for (const token of argv) {
    if (!command && !token.startsWith("-") && commands.has(token)) {
      command = token;
      continue;
    }

    rest.push(token);
  }

  return { command, rest };
}

function rootHelp(): string {
  return `Granola CLI

Export your Granola notes and transcripts.

Usage:
  granola <command> [options]

Commands:
  notes        Export Granola notes to Markdown
  transcripts  Export Granola transcripts to text files

Global options:
  --config <path>     Path to .granola.toml
  --debug             Enable debug logging
  --supabase <path>   Path to supabase.json
  -h, --help          Show help

Examples:
  granola notes --supabase "${granolaSupabaseCandidates()[0] ?? "/path/to/supabase.json"}"
  granola transcripts --cache "${granolaCacheCandidates()[0] ?? "/path/to/cache-v3.json"}"
`;
}

function notesHelp(): string {
  return `Granola notes

Usage:
  granola notes [options]

Options:
  --output <path>     Output directory for Markdown files (default: ./notes)
  --timeout <value>   Request timeout, e.g. 2m, 30s, 120000 (default: 2m)
  --supabase <path>   Path to supabase.json
  --debug             Enable debug logging
  --config <path>     Path to .granola.toml
  -h, --help          Show help
`;
}

function transcriptsHelp(): string {
  return `Granola transcripts

Usage:
  granola transcripts [options]

Options:
  --cache <path>      Path to Granola cache JSON
  --output <path>     Output directory for transcript files (default: ./transcripts)
  --debug             Enable debug logging
  --config <path>     Path to .granola.toml
  -h, --help          Show help
`;
}

function debug(enabled: boolean, ...values: unknown[]): void {
  if (enabled) {
    console.error("[debug]", ...values);
  }
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    const { command, rest } = splitCommand(argv);
    const global = parseFlags(rest, {
      config: { type: "string" },
      debug: { type: "boolean" },
      help: { type: "boolean" },
      supabase: { type: "string" },
    });

    if (global.values.help && !command) {
      console.log(rootHelp());
      return 0;
    }

    if (!command) {
      console.log(rootHelp());
      return 1;
    }

    switch (command) {
      case "notes": {
        const subcommand = parseFlags(global.rest, {
          help: { type: "boolean" },
          output: { type: "string" },
          timeout: { type: "string" },
        });

        if (subcommand.values.help || global.values.help) {
          console.log(notesHelp());
          return 0;
        }

        const config = await loadConfig({
          globalFlags: global.values,
          subcommandFlags: subcommand.values,
        });

        if (!config.supabase) {
          throw new Error(
            `supabase.json not found. Pass --supabase or create .granola.toml. Expected locations include: ${granolaSupabaseCandidates().join(", ")}`,
          );
        }

        debug(config.debug, "using config", config.configFileUsed ?? "(none)");
        debug(config.debug, "supabase", config.supabase);
        debug(config.debug, "timeoutMs", config.notes.timeoutMs);
        debug(config.debug, "output", config.notes.output);

        console.log("Fetching documents from Granola API...");
        const supabaseContents = await readFile(config.supabase, "utf8");
        const documents = await fetchDocuments({
          supabaseContents,
          timeoutMs: config.notes.timeoutMs,
        });

        console.log(`Exporting ${documents.length} notes to ${config.notes.output}...`);
        const written = await writeNotes(documents, config.notes.output);
        console.log("✓ Export completed successfully");
        debug(config.debug, "notes written", written);
        return 0;
      }

      case "transcripts": {
        const subcommand = parseFlags(global.rest, {
          cache: { type: "string" },
          help: { type: "boolean" },
          output: { type: "string" },
        });

        if (subcommand.values.help || global.values.help) {
          console.log(transcriptsHelp());
          return 0;
        }

        const config = await loadConfig({
          globalFlags: global.values,
          subcommandFlags: subcommand.values,
        });

        if (!config.transcripts.cacheFile) {
          throw new Error(
            `Granola cache file not found. Pass --cache or create .granola.toml. Expected locations include: ${granolaCacheCandidates().join(", ")}`,
          );
        }

        debug(config.debug, "using config", config.configFileUsed ?? "(none)");
        debug(config.debug, "cacheFile", config.transcripts.cacheFile);
        debug(config.debug, "output", config.transcripts.output);

        console.log("Reading Granola cache file...");
        const cacheContents = await readFile(config.transcripts.cacheFile, "utf8");
        const cacheData = parseCacheContents(cacheContents);
        const transcriptCount = Object.values(cacheData.transcripts).filter(
          (segments) => segments.length > 0,
        ).length;

        console.log(`Exporting ${transcriptCount} transcripts to ${config.transcripts.output}...`);
        const written = await writeTranscripts(cacheData, config.transcripts.output);
        console.log("✓ Export completed successfully");
        debug(config.debug, "transcripts written", written);
        return 0;
      }

      default:
        console.log(rootHelp());
        return 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}
