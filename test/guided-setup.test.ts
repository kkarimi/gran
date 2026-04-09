import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import {
  maybeRunGuidedSetupAfterInit,
  runGuidedSetupFlow,
  type GuidedSetupPrompter,
} from "../src/commands/guided-setup.ts";
import type { CommandAppContext } from "../src/commands/shared.ts";

class FakePrompt implements GuidedSetupPrompter {
  constructor(private readonly answers: string[]) {}

  close = vi.fn(async () => {});

  async ask(): Promise<string> {
    return this.answers.shift() ?? "";
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("guided setup", () => {
  test("saves an API key, imports meetings, and returns a browser launch plan", async () => {
    const prompt = new FakePrompt(["", "", "grn_test_123", "", ""]);
    const inspectAuth = vi.fn(async () => ({
      apiKeyAvailable: false,
      mode: "api-key" as const,
      refreshAvailable: false,
      storedSessionAvailable: false,
      supabaseAvailable: false,
    }));
    const loginAuth = vi.fn(async () => ({
      apiKeyAvailable: true,
      mode: "api-key" as const,
      refreshAvailable: false,
      storedSessionAvailable: false,
      supabaseAvailable: false,
    }));
    const sync = vi.fn(async () => ({
      changes: [],
      state: {},
      summary: {
        changedCount: 0,
        createdCount: 12,
        folderCount: 2,
        meetingCount: 12,
        removedCount: 0,
        transcriptReadyCount: 12,
      },
    }));
    const createAppContext = vi.fn(async () => ({
      app: {
        getState: () => ({
          index: {
            loaded: false,
            meetingCount: 0,
          },
          sync: {},
        }),
        inspectAuth,
        loginAuth,
        sync,
      },
      config: {},
    })) as unknown as (...args: unknown[]) => Promise<CommandAppContext>;

    const plan = await runGuidedSetupFlow({
      configPath: "/tmp/project/.gran/config.json",
      createAppContext,
      globalFlags: {},
      log: vi.fn(),
      prompt,
    });

    expect(plan).toEqual({
      surface: "web",
    });
    expect(loginAuth).toHaveBeenCalledWith({
      apiKey: "grn_test_123",
    });
    expect(sync).toHaveBeenCalledWith({
      foreground: true,
    });
    expect(createAppContext).toHaveBeenCalledWith(
      {},
      {
        config: "/tmp/project/.gran/config.json",
      },
    );
  });

  test("reuses existing auth and local archive without forcing another refresh", async () => {
    const prompt = new FakePrompt(["", "", ""]);
    const loginAuth = vi.fn();
    const sync = vi.fn();
    const createAppContext = vi.fn(async () => ({
      app: {
        getState: () => ({
          index: {
            loaded: true,
            meetingCount: 7,
          },
          sync: {
            lastCompletedAt: "2026-04-09T13:00:00.000Z",
          },
        }),
        inspectAuth: vi.fn(async () => ({
          apiKeyAvailable: true,
          mode: "api-key" as const,
          refreshAvailable: false,
          storedSessionAvailable: false,
          supabaseAvailable: false,
        })),
        loginAuth,
        sync,
      },
      config: {},
    })) as unknown as (...args: unknown[]) => Promise<CommandAppContext>;

    const plan = await runGuidedSetupFlow({
      configPath: "/tmp/project/.gran/config.json",
      createAppContext,
      globalFlags: {},
      log: vi.fn(),
      prompt,
    });

    expect(plan).toEqual({
      surface: "web",
    });
    expect(loginAuth).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  test("can skip auth and launch the terminal workspace from init", async () => {
    const prompt = new FakePrompt(["n", "2"]);
    const launchTui = vi.fn(async () => 0);
    const launchWeb = vi.fn(async () => 0);
    const createAppContext = vi.fn(async () => ({
      app: {
        getState: () => ({
          index: {
            loaded: false,
            meetingCount: 0,
          },
          sync: {},
        }),
        inspectAuth: vi.fn(async () => ({
          apiKeyAvailable: false,
          mode: "api-key" as const,
          refreshAvailable: false,
          storedSessionAvailable: false,
          supabaseAvailable: false,
        })),
      },
      config: {},
    })) as unknown as (...args: unknown[]) => Promise<CommandAppContext>;

    const exitCode = await maybeRunGuidedSetupAfterInit({
      commandFlags: {
        guided: true,
      },
      configPath: "/tmp/project/.gran/config.json",
      createAppContext,
      globalFlags: {},
      interactive: true,
      launchTui,
      launchWeb,
      log: vi.fn(),
      prompt,
    });

    expect(exitCode).toBe(0);
    expect(launchTui).toHaveBeenCalledWith({
      commandArgs: [],
      commandFlags: {
        foreground: true,
      },
      globalFlags: {
        config: "/tmp/project/.gran/config.json",
      },
    });
    expect(launchWeb).not.toHaveBeenCalled();
    expect(prompt.close).toHaveBeenCalled();
  });
});
