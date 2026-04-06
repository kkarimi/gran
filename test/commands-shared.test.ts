import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import * as appModule from "../src/app/index.ts";
import * as configModule from "../src/config.ts";
import { createCommandAppContext } from "../src/commands/shared.ts";
import type { AppConfig } from "../src/types.ts";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    configFileUsed: "/tmp/.granola.toml",
    debug: true,
    notes: {
      output: "/tmp/notes",
      timeoutMs: 120_000,
    },
    supabase: "/tmp/supabase.json",
    transcripts: {
      cacheFile: "/tmp/cache.json",
      output: "/tmp/transcripts",
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createCommandAppContext", () => {
  test("loads config, creates the app, and logs the requested debug fields", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const config = makeConfig();
    const app = {
      getState: () => ({
        auth: {
          mode: "api-key",
        },
      }),
    };

    const loadConfig = vi.spyOn(configModule, "loadConfig").mockResolvedValue(config);
    const createGranolaApp = vi
      .spyOn(appModule, "createGranolaApp")
      .mockResolvedValue(app as never);

    const result = await createCommandAppContext(
      {
        timeout: "30s",
      },
      {
        debug: true,
      },
      {
        includeCacheFile: true,
        includeSupabase: true,
        includeTimeoutMs: true,
        surface: "web",
      },
    );

    expect(loadConfig).toHaveBeenCalledWith({
      globalFlags: {
        debug: true,
      },
      subcommandFlags: {
        timeout: "30s",
      },
    });
    expect(createGranolaApp).toHaveBeenCalledWith(config, {
      surface: "web",
    });
    expect(result).toEqual({
      app,
      config,
    });
    expect(error).toHaveBeenCalledWith("[debug]", "using config", "/tmp/.granola.toml");
    expect(error).toHaveBeenCalledWith("[debug]", "supabase", "/tmp/supabase.json");
    expect(error).toHaveBeenCalledWith("[debug]", "cacheFile", "/tmp/cache.json");
    expect(error).toHaveBeenCalledWith("[debug]", "timeoutMs", 120_000);
    expect(error).toHaveBeenCalledWith("[debug]", "authMode", "api-key");
  });

  test("omits optional debug fields when they are not requested", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const config = makeConfig({
      configFileUsed: undefined,
      debug: true,
    });
    const app = {
      getState: () => ({
        auth: {
          mode: "stored-session",
        },
      }),
    };

    vi.spyOn(configModule, "loadConfig").mockResolvedValue(config);
    vi.spyOn(appModule, "createGranolaApp").mockResolvedValue(app as never);

    await createCommandAppContext({}, {});

    expect(error).toHaveBeenCalledWith("[debug]", "using config", "(none)");
    expect(error).toHaveBeenCalledWith("[debug]", "authMode", "stored-session");
    expect(error).not.toHaveBeenCalledWith("[debug]", "supabase", expect.anything());
    expect(error).not.toHaveBeenCalledWith("[debug]", "cacheFile", expect.anything());
    expect(error).not.toHaveBeenCalledWith("[debug]", "timeoutMs", expect.anything());
  });
});
