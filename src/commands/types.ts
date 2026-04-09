import type { FlagValues } from "../config.ts";
import type { ParseSpec } from "../flags.ts";

export interface CommandContext {
  commandArgs: string[];
  commandFlags: FlagValues;
  globalFlags: FlagValues;
}

export interface CommandDefinition {
  aliases?: string[];
  description: string;
  flags: Record<string, ParseSpec>;
  help(): string;
  name: string;
  run(context: CommandContext): Promise<number>;
}
