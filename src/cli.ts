import { commandMap, commands } from "./commands/index.ts";
import type { CommandDefinition } from "./commands/types.ts";
import { parseFlags } from "./flags.ts";

function splitCommand(argv: string[]): { command?: CommandDefinition; rest: string[] } {
  const rest: string[] = [];
  let command: CommandDefinition | undefined;

  for (const token of argv) {
    const candidate = !token.startsWith("-") ? commandMap.get(token) : undefined;
    if (!command && candidate) {
      command = candidate;
      continue;
    }

    rest.push(token);
  }

  return { command, rest };
}

function rootHelp(): string {
  const commandWidth = Math.max(...commands.map((command) => command.name.length));
  const commandLines = commands
    .map((command) => `  ${command.name.padEnd(commandWidth)}  ${command.description}`)
    .join("\n");

  return `Gran 👵🏻

Sync, search, export, and automate your Granola archive locally.

Usage:
  gran <command> [options]

Commands:
${commandLines}

Global options:
  --api-key <token>   Granola Personal API key
  --config <path>     Path to .gran.json
  --debug             Enable debug logging
  --rules <path>      Path to automation rules JSON
  --supabase <path>   Path to supabase.json
  -h, --help          Show help

Examples:
  gran attach http://127.0.0.1:4123
  gran export --folder Team
  gran targets add --id work-vault --kind obsidian-vault --output ~/Vaults/Work
  gran folder list
  gran intelligence run decisions --last 5
  gran init --provider openrouter
  gran service start
  gran sync
  gran notes --supabase "/path/to/supabase.json"
  gran transcripts --cache "/path/to/granola-cache.json"
`;
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    const { command, rest } = splitCommand(argv);
    const global = parseFlags(rest, {
      "api-key": { type: "string" },
      config: { type: "string" },
      debug: { type: "boolean" },
      help: { type: "boolean" },
      rules: { type: "string" },
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

    const subcommand = parseFlags(global.rest, command.flags);

    if (subcommand.values.help || global.values.help) {
      console.log(command.help());
      return 0;
    }

    return await command.run({
      commandArgs: subcommand.rest,
      commandFlags: subcommand.values,
      globalFlags: global.values,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}
