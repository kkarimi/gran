import type { FlagValues } from "../config.ts";

function appendFlag(args: string[], name: string, value: string | boolean | undefined): void {
  if (value === undefined || value === false) {
    return;
  }

  args.push(`--${name}`);
  if (typeof value === "string") {
    args.push(value);
  }
}

export function serialiseManagedServiceFlags(
  commandFlags: FlagValues,
  globalFlags: FlagValues,
): { args: string[]; env: NodeJS.ProcessEnv } {
  const args: string[] = [];
  appendFlag(args, "network", commandFlags.network);
  appendFlag(args, "hostname", commandFlags.hostname);
  appendFlag(args, "port", commandFlags.port);
  appendFlag(args, "password", commandFlags.password);
  appendFlag(args, "sync-interval", commandFlags["sync-interval"]);
  appendFlag(args, "no-sync", commandFlags["no-sync"]);
  appendFlag(args, "trusted-origins", commandFlags["trusted-origins"]);
  appendFlag(args, "cache", commandFlags.cache);
  appendFlag(args, "timeout", commandFlags.timeout);
  appendFlag(args, "config", globalFlags.config);
  appendFlag(args, "rules", globalFlags.rules);
  appendFlag(args, "supabase", globalFlags.supabase);
  appendFlag(args, "debug", globalFlags.debug);

  const env = { ...process.env };
  if (typeof globalFlags["api-key"] === "string" && globalFlags["api-key"].trim()) {
    env.GRAN_API_KEY = globalFlags["api-key"].trim();
    env.GRANOLA_API_KEY = globalFlags["api-key"].trim();
  }

  return { args, env };
}
