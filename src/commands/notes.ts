import { renderExportScopeLabel } from "../export-scope.ts";
import type { NoteOutputFormat } from "../types.ts";

import { createCommandAppContext, debug } from "./shared.ts";
import type { CommandDefinition } from "./types.ts";

function notesHelp(): string {
  return `Gran notes

Usage:
  gran notes [options]

Options:
  --folder <query>    Export only meetings inside one folder id or name
  --format <value>    Output format: markdown, json, yaml, raw (default: markdown)
  --output <path>     Output directory for note files (default: ./notes)
  --timeout <value>   Request timeout, e.g. 2m, 30s, 120000 (default: 2m)
  --supabase <path>   Path to supabase.json
  --debug             Enable debug logging
  --config <path>     Path to .gran.json
  -h, --help          Show help
`;
}

export const notesCommand: CommandDefinition = {
  description: "Export Granola notes",
  flags: {
    folder: { type: "string" },
    format: { type: "string" },
    help: { type: "boolean" },
    output: { type: "string" },
    timeout: { type: "string" },
  },
  help: notesHelp,
  name: "notes",
  async run({ commandFlags, globalFlags }) {
    const { app, config } = await createCommandAppContext(commandFlags, globalFlags, {
      includeSupabase: true,
      includeTimeoutMs: true,
    });

    debug(config.debug, "output", config.notes.output);
    const format = resolveNoteFormat(commandFlags.format);
    debug(config.debug, "format", format);
    const folderQuery = typeof commandFlags.folder === "string" ? commandFlags.folder : undefined;
    const folder = folderQuery ? await app.findFolder(folderQuery) : undefined;
    debug(config.debug, "folder", folder?.id ?? "(all)");

    const result = await app.exportNotes(format, {
      folderId: folder?.id,
      scopedOutput: typeof commandFlags.output !== "string",
    });
    console.log(
      `✓ Exported ${result.documentCount} notes from ${renderExportScopeLabel(result.scope)} to ${result.outputDir} (job ${result.job.id})`,
    );
    debug(config.debug, "notes written", result.written);
    return 0;
  },
};

function resolveNoteFormat(value: string | boolean | undefined): NoteOutputFormat {
  switch (value) {
    case undefined:
      return "markdown";
    case "json":
    case "markdown":
    case "raw":
    case "yaml":
      return value;
    default:
      throw new Error("invalid notes format: expected markdown, json, yaml, or raw");
  }
}
