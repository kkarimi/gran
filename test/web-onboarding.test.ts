import { describe, expect, test } from "vite-plus/test";

import type { GranolaAppState } from "../src/app/index.ts";
import {
  buildStarterPipeline,
  deriveOnboardingState,
  starterHarnessId,
  starterRuleId,
} from "../src/web-app/onboarding.tsx";
import type { GranolaServerInfo } from "../src/transport.ts";

describe("web onboarding", () => {
  test("derives setup progress from auth, sync, and automation state", () => {
    const serverInfo: GranolaServerInfo = {
      build: {
        gitCommit: "1234567890abcdef1234567890abcdef12345678",
        gitCommitShort: "1234567",
        packageName: "@kkarimi/gran",
        repositoryUrl: "git+https://github.com/kkarimi/gran.git",
        version: "0.66.0",
      },
      config: {
        automationRulesFile: "/tmp/automation-rules.json",
        configFile: "/tmp/.gran.json",
        notesOutputDir: "/tmp/notes",
        pluginsFile: "/tmp/plugins.json",
        supabaseFile: "/tmp/supabase.json",
        transcriptCacheFile: "/tmp/cache.json",
        transcriptsOutputDir: "/tmp/transcripts",
      },
      capabilities: {
        attach: true,
        auth: true,
        automation: true,
        events: true,
        exports: true,
        folders: true,
        meetingOpen: true,
        plugins: true,
        processing: true,
        sync: true,
        webClient: true,
      },
      persistence: {
        catalogSnapshotFile: "/tmp/catalog-snapshot.json",
        dataDirectory: "/tmp/gran",
        exportJobs: true,
        exportJobsFile: "/tmp/export-jobs.json",
        meetingIndex: true,
        meetingIndexFile: "/tmp/meeting-index.json",
        searchIndexFile: "/tmp/search-index.json",
        sessionStore: "file",
        sessionFile: "/tmp/session.json",
        serviceLogFile: "/tmp/service.log",
        serviceStateFile: "/tmp/service.json",
        syncEvents: true,
        syncEventsFile: "/tmp/sync-events.jsonl",
        syncState: true,
        syncStateFile: "/tmp/sync-state.json",
      },
      product: "gran",
      protocolVersion: 5,
      runtime: {
        mode: "background-service",
        startedAt: "2026-04-05T10:00:00.000Z",
        syncEnabled: true,
        syncIntervalMs: 60_000,
      },
      transport: "local-http",
    };
    const appState = {
      auth: {
        apiKeyAvailable: true,
        mode: "api-key",
        refreshAvailable: false,
        storedSessionAvailable: false,
        supabaseAvailable: false,
      },
      automation: {
        artefactCount: 0,
        loaded: true,
        matchCount: 0,
        pendingArtefactCount: 0,
        pendingRunCount: 0,
        ruleCount: 1,
        runCount: 0,
      },
      cache: {
        configured: true,
        documentCount: 2,
        filePath: "/tmp/cache.json",
        loaded: true,
        transcriptCount: 1,
      },
      config: {
        debug: false,
        notes: {
          output: "/tmp/notes",
          timeoutMs: 120_000,
        },
        transcripts: {
          cacheFile: "/tmp/cache.json",
          output: "/tmp/transcripts",
        },
      },
      documents: {
        count: 2,
        loaded: true,
      },
      exports: {
        jobs: [],
      },
      folders: {
        count: 2,
        loaded: true,
      },
      index: {
        available: true,
        filePath: "/tmp/index.json",
        loaded: true,
        meetingCount: 2,
      },
      plugins: {
        items: [
          {
            capabilities: ["automation"],
            configurable: true,
            description: "Automation plugin",
            enabled: true,
            id: "automation",
            label: "Automation",
            shipped: true,
          },
          {
            capabilities: ["markdown-rendering"],
            configurable: true,
            description: "Markdown viewer plugin",
            enabled: true,
            id: "markdown-viewer",
            label: "Markdown Viewer",
            shipped: true,
          },
        ],
        loaded: true,
      },
      sync: {
        eventCount: 1,
        eventsFile: "/tmp/sync-events.jsonl",
        filePath: "/tmp/sync-state.json",
        lastChanges: [],
        lastCompletedAt: "2024-03-01T12:00:00.000Z",
        running: false,
      },
      ui: {
        surface: "web",
      },
    } satisfies GranolaAppState;

    const derived = deriveOnboardingState({
      appState,
      meetingsLoadedCount: 2,
      serverInfo,
    });

    expect(derived.activeStepId).toBe(null);
    expect(derived.complete).toBe(true);
    expect(derived.connected).toBe(true);
    expect(derived.synced).toBe(true);
    expect(derived.serviceDetail).toBe("Background service active · sync every minute.");
    expect(derived.stepCards.map((step) => step.complete)).toEqual([true, true]);
  });

  test("treats onboarding as complete once auth and first sync are ready", () => {
    const appState = {
      auth: {
        apiKeyAvailable: true,
        mode: "api-key",
        refreshAvailable: false,
        storedSessionAvailable: false,
        supabaseAvailable: false,
      },
      automation: {
        artefactCount: 0,
        loaded: false,
        matchCount: 0,
        pendingArtefactCount: 0,
        pendingRunCount: 0,
        ruleCount: 0,
        runCount: 0,
      },
      cache: {
        configured: true,
        documentCount: 2,
        filePath: "/tmp/cache.json",
        loaded: true,
        transcriptCount: 1,
      },
      config: {
        debug: false,
        notes: {
          output: "/tmp/notes",
          timeoutMs: 120_000,
        },
        transcripts: {
          cacheFile: "/tmp/cache.json",
          output: "/tmp/transcripts",
        },
      },
      documents: {
        count: 2,
        loaded: true,
      },
      exports: {
        jobs: [],
      },
      folders: {
        count: 2,
        loaded: true,
      },
      index: {
        available: true,
        filePath: "/tmp/index.json",
        loaded: true,
        meetingCount: 2,
      },
      plugins: {
        items: [
          {
            capabilities: ["automation"],
            configurable: true,
            description: "Automation plugin",
            enabled: false,
            id: "automation",
            label: "Automation",
            shipped: true,
          },
          {
            capabilities: ["markdown-rendering"],
            configurable: true,
            description: "Markdown viewer plugin",
            enabled: true,
            id: "markdown-viewer",
            label: "Markdown Viewer",
            shipped: true,
          },
        ],
        loaded: true,
      },
      sync: {
        eventCount: 1,
        eventsFile: "/tmp/sync-events.jsonl",
        filePath: "/tmp/sync-state.json",
        lastChanges: [],
        lastCompletedAt: "2024-03-01T12:00:00.000Z",
        running: false,
      },
      ui: {
        surface: "web",
      },
    } satisfies GranolaAppState;

    const derived = deriveOnboardingState({
      appState,
      meetingsLoadedCount: 2,
      serverInfo: null,
    });

    expect(derived.complete).toBe(true);
    expect(derived.stepCards).toEqual([
      expect.objectContaining({
        complete: true,
        title: "Connect Granola",
      }),
      expect.objectContaining({
        complete: true,
        title: "Import Meetings",
      }),
    ]);
  });

  test("builds a starter pipeline around the chosen provider", () => {
    const result = buildStarterPipeline({
      harnesses: [],
      provider: "openrouter",
      rules: [],
    });

    expect(result.harnesses).toEqual([
      expect.objectContaining({
        id: starterHarnessId,
        model: "openai/gpt-5-mini",
        provider: "openrouter",
      }),
    ]);
    expect(result.rules).toEqual([
      expect.objectContaining({
        id: starterRuleId,
        actions: [
          expect.objectContaining({
            harnessId: starterHarnessId,
            kind: "agent",
          }),
        ],
      }),
    ]);
  });
});
