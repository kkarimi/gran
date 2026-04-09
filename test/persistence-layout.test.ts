import { describe, expect, test } from "vite-plus/test";

import {
  defaultGranolaToolkitDataDirectory,
  defaultGranolaToolkitPersistenceLayout,
} from "../src/persistence/layout.ts";

describe("defaultGranolaToolkitDataDirectory", () => {
  test("uses ~/.config on macOS", () => {
    expect(defaultGranolaToolkitDataDirectory("/Users/nima")).toBe("/Users/nima/.config/gran");
  });

  test("uses ~/.config on Linux", () => {
    expect(defaultGranolaToolkitDataDirectory("/home/nima")).toBe("/home/nima/.config/gran");
  });
});

describe("defaultGranolaToolkitPersistenceLayout", () => {
  test("keeps the file layout in one shared directory", () => {
    expect(
      defaultGranolaToolkitPersistenceLayout({
        homeDirectory: "/home/nima",
        platform: "linux",
      }),
    ).toEqual({
      agentHarnessesFile: "/home/nima/.config/gran/agent-harnesses.json",
      apiKeyFile: "/home/nima/.config/gran/api-key.txt",
      automationArtefactsFile: "/home/nima/.config/gran/automation-artefacts.json",
      automationMatchesFile: "/home/nima/.config/gran/automation-matches.jsonl",
      automationRulesFile: "/home/nima/.config/gran/automation-rules.json",
      automationRunsFile: "/home/nima/.config/gran/automation-runs.jsonl",
      catalogSnapshotFile: "/home/nima/.config/gran/catalog-snapshot.json",
      dataDirectory: "/home/nima/.config/gran",
      exportJobsFile: "/home/nima/.config/gran/export-jobs.json",
      exportTargetsFile: "/home/nima/.config/gran/export-targets.json",
      meetingIndexFile: "/home/nima/.config/gran/meeting-index.json",
      pkmTargetsFile: "/home/nima/.config/gran/pkm-targets.json",
      pluginsFile: "/home/nima/.config/gran/plugins.json",
      searchIndexFile: "/home/nima/.config/gran/search-index.json",
      serviceLogFile: "/home/nima/.config/gran/service.log",
      serviceStateFile: "/home/nima/.config/gran/service.json",
      sessionFile: "/home/nima/.config/gran/session.json",
      sessionStoreKind: "file",
      syncEventsFile: "/home/nima/.config/gran/sync-events.jsonl",
      syncStateFile: "/home/nima/.config/gran/sync-state.json",
    });
  });

  test("reports the keychain-backed session store on macOS", () => {
    expect(
      defaultGranolaToolkitPersistenceLayout({
        homeDirectory: "/Users/nima",
        platform: "darwin",
      }).sessionStoreKind,
    ).toBe("keychain");
  });
});
