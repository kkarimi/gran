import type { GranolaPkmTarget } from "./app/index.ts";
import { resolveObsidianTargetRuntime } from "./pkm-target-registry.ts";

function encodeUriValue(value: string): string {
  return encodeURIComponent(value.replaceAll("\\", "/"));
}

function buildObsidianUri(params: Record<string, string | undefined>): string {
  const query = Object.entries(params)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([key, value]) => `${key}=${encodeUriValue(value!)}`)
    .join("&");
  return query ? `obsidian://open?${query}` : "obsidian://open";
}

export function buildObsidianOpenFileUri(options: {
  filePath: string;
  target: Pick<GranolaPkmTarget, "dailyNotesDir" | "name" | "outputDir" | "vaultName">;
}): string {
  const runtime = resolveObsidianTargetRuntime(options.target);
  return buildObsidianUri({
    file: options.filePath,
    vault: runtime.vaultName,
  });
}

export function buildObsidianSearchUri(options: {
  query: string;
  target: Pick<GranolaPkmTarget, "dailyNotesDir" | "name" | "outputDir" | "vaultName">;
}): string {
  const runtime = resolveObsidianTargetRuntime(options.target);
  return buildObsidianUri({
    query: options.query,
    vault: runtime.vaultName,
  }).replace("obsidian://open?", "obsidian://search?");
}
