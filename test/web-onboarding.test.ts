import { describe, expect, test } from "vite-plus/test";

import type { GranolaAppState } from "../src/app/index.ts";
import {
  buildStarterPipeline,
  deriveOnboardingState,
  starterHarnessId,
  starterRuleId,
} from "../src/web-app/onboarding.tsx";

describe("web onboarding", () => {
  test("derives setup progress from auth, sync, and automation state", () => {
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
        view: "idle",
      },
    } satisfies GranolaAppState;

    const derived = deriveOnboardingState({
      appState,
      automationRuleCount: 1,
      harnesses: [
        {
          id: starterHarnessId,
          name: "Starter Meeting Notes",
          prompt: "Write notes.",
          provider: "openrouter",
        },
      ],
      meetingsLoadedCount: 2,
    });

    expect(derived.complete).toBe(true);
    expect(derived.connected).toBe(true);
    expect(derived.synced).toBe(true);
    expect(derived.pipelineReady).toBe(true);
    expect(derived.stepCards.map((step) => step.complete)).toEqual([true, true, true]);
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
