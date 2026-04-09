import { createGranolaApp } from "../app/index.ts";
import { loadConfig } from "../config.ts";
import {
  renderFolderList,
  renderFolderView,
  type FolderDetailOutputFormat,
  type FolderListOutputFormat,
} from "../folders.ts";

import { debug } from "./shared.ts";
import type { CommandDefinition } from "./types.ts";

function folderHelp(): string {
  return `Gran folder

Usage:
  gran folder <list|view> [options]

Subcommands:
  list                List folders from the Granola API
  view <id|name>      Show one folder and its meetings

Options:
  --format <value>    text, json, yaml
  --limit <n>         Number of folders for list (default: 20)
  --search <query>    Filter folders by id, name, or description
  --timeout <value>   Request timeout, e.g. 2m, 30s, 120000 (default: 2m)
  --supabase <path>   Path to supabase.json
  --debug             Enable debug logging
  --config <path>     Path to JSON config file
  -h, --help          Show help
`;
}

function resolveFolderListFormat(value: string | boolean | undefined): FolderListOutputFormat {
  switch (value) {
    case undefined:
      return "text";
    case "json":
    case "text":
    case "yaml":
      return value;
    default:
      throw new Error("invalid folder format: expected text, json, or yaml");
  }
}

function resolveFolderDetailFormat(value: string | boolean | undefined): FolderDetailOutputFormat {
  return resolveFolderListFormat(value);
}

function parseLimit(value: string | boolean | undefined): number {
  if (value === undefined) {
    return 20;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("invalid folder limit: expected a positive integer");
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("invalid folder limit: expected a positive integer");
  }

  return limit;
}

export const folderCommand: CommandDefinition = {
  description: "Inspect folders and their meetings",
  flags: {
    format: { type: "string" },
    help: { type: "boolean" },
    limit: { type: "string" },
    search: { type: "string" },
    timeout: { type: "string" },
  },
  help: folderHelp,
  name: "folder",
  async run({ commandArgs, commandFlags, globalFlags }) {
    const [action, query] = commandArgs;

    switch (action) {
      case "list":
        return await list(commandFlags, globalFlags);
      case "view":
        if (!query) {
          throw new Error("folder view requires an id or name");
        }
        return await view(query, commandFlags, globalFlags);
      case undefined:
        console.log(folderHelp());
        return 1;
      default:
        throw new Error("invalid folder command: expected list or view");
    }
  },
};

async function list(
  commandFlags: Record<string, string | boolean | undefined>,
  globalFlags: Record<string, string | boolean | undefined>,
): Promise<number> {
  const format = resolveFolderListFormat(commandFlags.format);
  const limit = parseLimit(commandFlags.limit);
  const search = typeof commandFlags.search === "string" ? commandFlags.search : undefined;

  const config = await loadConfig({
    globalFlags,
    subcommandFlags: commandFlags,
  });
  debug(config.debug, "using config", config.configFileUsed ?? "(none)");
  debug(config.debug, "supabase", config.supabase);
  debug(config.debug, "timeoutMs", config.notes.timeoutMs);
  const app = await createGranolaApp(config);
  debug(config.debug, "authMode", app.getState().auth.mode);

  console.log("Loading folders...");
  const result = await app.listFolders({ limit, search });
  console.log(renderFolderList(result.folders, format).trimEnd());
  return 0;
}

async function view(
  query: string,
  commandFlags: Record<string, string | boolean | undefined>,
  globalFlags: Record<string, string | boolean | undefined>,
): Promise<number> {
  const format = resolveFolderDetailFormat(commandFlags.format);
  const config = await loadConfig({
    globalFlags,
    subcommandFlags: commandFlags,
  });
  debug(config.debug, "using config", config.configFileUsed ?? "(none)");
  debug(config.debug, "supabase", config.supabase);
  debug(config.debug, "timeoutMs", config.notes.timeoutMs);
  const app = await createGranolaApp(config);
  debug(config.debug, "authMode", app.getState().auth.mode);

  console.log("Fetching folder from Granola API...");
  const result = await app.findFolder(query);
  console.log(renderFolderView(result, format).trimEnd());
  return 0;
}
