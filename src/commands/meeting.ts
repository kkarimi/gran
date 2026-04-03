import { existsSync } from "node:fs";

import { createDefaultGranolaApiClient, loadOptionalGranolaCache } from "../client/default.ts";
import { loadConfig } from "../config.ts";
import {
  buildMeetingRecord,
  listMeetings,
  renderMeetingExport,
  renderMeetingList,
  renderMeetingNotes,
  renderMeetingTranscript,
  renderMeetingView,
  resolveMeeting,
  type MeetingDetailOutputFormat,
  type MeetingExportOutputFormat,
  type MeetingListOutputFormat,
  type MeetingNotesOutputFormat,
  type MeetingTranscriptOutputFormat,
} from "../meetings.ts";
import { granolaCacheCandidates } from "../utils.ts";

import { debug } from "./shared.ts";
import type { CommandDefinition } from "./types.ts";

function meetingHelp(): string {
  return `Granola meeting

Usage:
  granola meeting <list|view|export|notes|transcript> [options]

Subcommands:
  list                List meetings from the Granola API
  view <id>           Show a single meeting with notes and transcript text
  export <id>         Export a single meeting as JSON or YAML
  notes <id>          Show a single meeting's notes
  transcript <id>     Show a single meeting's transcript

Options:
  --cache <path>      Path to Granola cache JSON for transcript data
  --format <value>    list/view: text, json, yaml; export: json, yaml; notes: markdown, json, yaml, raw; transcript: text, json, yaml, raw
  --limit <n>         Number of meetings for list (default: 20)
  --search <query>    Filter list by title, id, or tag
  --timeout <value>   Request timeout, e.g. 2m, 30s, 120000 (default: 2m)
  --supabase <path>   Path to supabase.json
  --debug             Enable debug logging
  --config <path>     Path to .granola.toml
  -h, --help          Show help
`;
}

function resolveListFormat(value: string | boolean | undefined): MeetingListOutputFormat {
  switch (value) {
    case undefined:
      return "text";
    case "json":
    case "text":
    case "yaml":
      return value;
    default:
      throw new Error("invalid meeting format: expected text, json, or yaml");
  }
}

function resolveViewFormat(value: string | boolean | undefined): MeetingDetailOutputFormat {
  switch (value) {
    case undefined:
      return "text";
    case "json":
    case "text":
    case "yaml":
      return value;
    default:
      throw new Error("invalid meeting format: expected text, json, or yaml");
  }
}

function resolveExportFormat(value: string | boolean | undefined): MeetingExportOutputFormat {
  switch (value) {
    case undefined:
      return "json";
    case "json":
    case "yaml":
      return value;
    default:
      throw new Error("invalid meeting export format: expected json or yaml");
  }
}

function resolveNotesFormat(value: string | boolean | undefined): MeetingNotesOutputFormat {
  switch (value) {
    case undefined:
      return "markdown";
    case "json":
    case "markdown":
    case "raw":
    case "yaml":
      return value;
    default:
      throw new Error("invalid meeting notes format: expected markdown, json, yaml, or raw");
  }
}

function resolveTranscriptFormat(
  value: string | boolean | undefined,
): MeetingTranscriptOutputFormat {
  switch (value) {
    case undefined:
      return "text";
    case "json":
    case "raw":
    case "text":
    case "yaml":
      return value;
    default:
      throw new Error("invalid meeting transcript format: expected text, json, yaml, or raw");
  }
}

function parseLimit(value: string | boolean | undefined): number {
  if (value === undefined) {
    return 20;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("invalid meeting limit: expected a positive integer");
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("invalid meeting limit: expected a positive integer");
  }

  return limit;
}

export const meetingCommand: CommandDefinition = {
  description: "Inspect and export individual Granola meetings",
  flags: {
    cache: { type: "string" },
    format: { type: "string" },
    help: { type: "boolean" },
    limit: { type: "string" },
    search: { type: "string" },
    timeout: { type: "string" },
  },
  help: meetingHelp,
  name: "meeting",
  async run({ commandArgs, commandFlags, globalFlags }) {
    const [action, id] = commandArgs;

    switch (action) {
      case "list":
        return await list(commandFlags, globalFlags);
      case "view":
        if (!id) {
          throw new Error("meeting view requires an id");
        }
        return await view(id, commandFlags, globalFlags);
      case "export":
        if (!id) {
          throw new Error("meeting export requires an id");
        }
        return await exportMeeting(id, commandFlags, globalFlags);
      case "notes":
        if (!id) {
          throw new Error("meeting notes requires an id");
        }
        return await notes(id, commandFlags, globalFlags);
      case "transcript":
        if (!id) {
          throw new Error("meeting transcript requires an id");
        }
        return await transcript(id, commandFlags, globalFlags);
      case undefined:
        console.log(meetingHelp());
        return 1;
      default:
        throw new Error(
          "invalid meeting command: expected list, view, export, notes, or transcript",
        );
    }
  },
};

async function loadMeetingData(
  commandFlags: Record<string, string | boolean | undefined>,
  globalFlags: Record<string, string | boolean | undefined>,
  options: { requireCache?: boolean } = {},
) {
  const config = await loadConfig({
    globalFlags,
    subcommandFlags: commandFlags,
  });

  if (options.requireCache && !config.transcripts.cacheFile) {
    throw new Error(
      `Granola cache file not found. Pass --cache or create .granola.toml. Expected locations include: ${granolaCacheCandidates().join(", ")}`,
    );
  }

  if (config.transcripts.cacheFile && !existsSync(config.transcripts.cacheFile)) {
    throw new Error(`Granola cache file not found: ${config.transcripts.cacheFile}`);
  }

  debug(config.debug, "using config", config.configFileUsed ?? "(none)");
  debug(config.debug, "supabase", config.supabase);
  debug(config.debug, "cacheFile", config.transcripts.cacheFile || "(none)");
  debug(config.debug, "timeoutMs", config.notes.timeoutMs);

  const granolaClient = await createDefaultGranolaApiClient(config);
  const cacheData = await loadOptionalGranolaCache(config.transcripts.cacheFile);

  return { cacheData, config, granolaClient };
}

async function loadResolvedMeeting(
  id: string,
  commandFlags: Record<string, string | boolean | undefined>,
  globalFlags: Record<string, string | boolean | undefined>,
  options: { requireCache?: boolean } = {},
) {
  const { cacheData, config, granolaClient } = await loadMeetingData(
    commandFlags,
    globalFlags,
    options,
  );
  console.log("Fetching meeting from Granola API...");
  const documents = await granolaClient.listDocuments({ timeoutMs: config.notes.timeoutMs });

  return {
    cacheData,
    config,
    document: resolveMeeting(documents, id),
  };
}

async function list(
  commandFlags: Record<string, string | boolean | undefined>,
  globalFlags: Record<string, string | boolean | undefined>,
): Promise<number> {
  const format = resolveListFormat(commandFlags.format);
  const limit = parseLimit(commandFlags.limit);
  const search = typeof commandFlags.search === "string" ? commandFlags.search : undefined;

  const { cacheData, config, granolaClient } = await loadMeetingData(commandFlags, globalFlags);
  console.log("Fetching meetings from Granola API...");
  const documents = await granolaClient.listDocuments({ timeoutMs: config.notes.timeoutMs });
  const meetings = listMeetings(documents, {
    cacheData,
    limit,
    search,
  });

  console.log(renderMeetingList(meetings, format).trimEnd());
  return 0;
}

async function view(
  id: string,
  commandFlags: Record<string, string | boolean | undefined>,
  globalFlags: Record<string, string | boolean | undefined>,
): Promise<number> {
  const format = resolveViewFormat(commandFlags.format);

  const { cacheData, document } = await loadResolvedMeeting(id, commandFlags, globalFlags);
  const meeting = buildMeetingRecord(document, cacheData);

  console.log(renderMeetingView(meeting, format).trimEnd());
  return 0;
}

async function exportMeeting(
  id: string,
  commandFlags: Record<string, string | boolean | undefined>,
  globalFlags: Record<string, string | boolean | undefined>,
): Promise<number> {
  const format = resolveExportFormat(commandFlags.format);

  const { cacheData, document } = await loadResolvedMeeting(id, commandFlags, globalFlags);
  const meeting = buildMeetingRecord(document, cacheData);

  console.log(renderMeetingExport(meeting, format).trimEnd());
  return 0;
}

async function notes(
  id: string,
  commandFlags: Record<string, string | boolean | undefined>,
  globalFlags: Record<string, string | boolean | undefined>,
): Promise<number> {
  const format = resolveNotesFormat(commandFlags.format);
  const { document } = await loadResolvedMeeting(id, commandFlags, globalFlags);

  console.log(renderMeetingNotes(document, format).trimEnd());
  return 0;
}

async function transcript(
  id: string,
  commandFlags: Record<string, string | boolean | undefined>,
  globalFlags: Record<string, string | boolean | undefined>,
): Promise<number> {
  const format = resolveTranscriptFormat(commandFlags.format);
  const { cacheData, document } = await loadResolvedMeeting(id, commandFlags, globalFlags, {
    requireCache: true,
  });
  const output = renderMeetingTranscript(document, cacheData, format);
  if (!output.trim()) {
    throw new Error(`no transcript found for meeting: ${document.id}`);
  }

  console.log(output.trimEnd());
  return 0;
}
