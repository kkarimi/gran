import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export type GranolaToolkitSessionStoreKind = "file" | "keychain";

export interface GranolaToolkitPersistenceLayout {
  agentHarnessesFile: string;
  automationArtefactsFile: string;
  automationMatchesFile: string;
  automationRulesFile: string;
  automationRunsFile: string;
  apiKeyFile: string;
  catalogSnapshotFile: string;
  dataDirectory: string;
  exportJobsFile: string;
  exportTargetsFile: string;
  meetingIndexFile: string;
  pluginsFile: string;
  pkmTargetsFile: string;
  searchIndexFile: string;
  serviceLogFile: string;
  serviceStateFile: string;
  sessionFile: string;
  sessionStoreKind: GranolaToolkitSessionStoreKind;
  syncEventsFile: string;
  syncStateFile: string;
}

function legacyGranolaToolkitDataDirectory(
  targetPlatform: NodeJS.Platform,
  homeDirectory: string,
): string {
  return targetPlatform === "darwin"
    ? join(homeDirectory, "Library", "Application Support", "granola-toolkit")
    : join(homeDirectory, ".config", "granola-toolkit");
}

export function defaultGranolaToolkitDataDirectory(
  targetPlatform: NodeJS.Platform = platform(),
  homeDirectory = homedir(),
): string {
  return targetPlatform === "darwin"
    ? join(homeDirectory, "Library", "Application Support", "gran")
    : join(homeDirectory, ".config", "gran");
}

export function defaultGranolaToolkitPersistenceLayout(
  options: {
    homeDirectory?: string;
    platform?: NodeJS.Platform;
  } = {},
): GranolaToolkitPersistenceLayout {
  const targetPlatform = options.platform ?? platform();
  const homeDirectory = options.homeDirectory ?? homedir();
  const defaultDataDirectory = defaultGranolaToolkitDataDirectory(targetPlatform, homeDirectory);
  const legacyDirectory = legacyGranolaToolkitDataDirectory(targetPlatform, homeDirectory);
  const dataDirectory =
    !existsSync(defaultDataDirectory) && existsSync(legacyDirectory)
      ? legacyDirectory
      : defaultDataDirectory;

  return {
    agentHarnessesFile: join(dataDirectory, "agent-harnesses.json"),
    automationArtefactsFile: join(dataDirectory, "automation-artefacts.json"),
    automationMatchesFile: join(dataDirectory, "automation-matches.jsonl"),
    automationRulesFile: join(dataDirectory, "automation-rules.json"),
    automationRunsFile: join(dataDirectory, "automation-runs.jsonl"),
    apiKeyFile: join(dataDirectory, "api-key.txt"),
    catalogSnapshotFile: join(dataDirectory, "catalog-snapshot.json"),
    dataDirectory,
    exportJobsFile: join(dataDirectory, "export-jobs.json"),
    exportTargetsFile: join(dataDirectory, "export-targets.json"),
    meetingIndexFile: join(dataDirectory, "meeting-index.json"),
    pluginsFile: join(dataDirectory, "plugins.json"),
    pkmTargetsFile: join(dataDirectory, "pkm-targets.json"),
    searchIndexFile: join(dataDirectory, "search-index.json"),
    serviceLogFile: join(dataDirectory, "service.log"),
    serviceStateFile: join(dataDirectory, "service.json"),
    sessionFile: join(dataDirectory, "session.json"),
    sessionStoreKind: targetPlatform === "darwin" ? "keychain" : "file",
    syncEventsFile: join(dataDirectory, "sync-events.jsonl"),
    syncStateFile: join(dataDirectory, "sync-state.json"),
  };
}
