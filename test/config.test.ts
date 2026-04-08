import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, test } from "vite-plus/test";

import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  test("loads flat JSON config values", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gran-config-"));
    const configPath = join(directory, ".gran.json");

    await writeFile(
      configPath,
      JSON.stringify(
        {
          "agent-dry-run": true,
          "agent-harnesses-file": "./agent-harnesses.json",
          "agent-max-retries": 4,
          "agent-model": "openai/gpt-5-mini",
          "agent-provider": "openrouter",
          "agent-timeout": "45s",
          "cache-file": "/tmp/cache.json",
          "codex-command": "codex-beta",
          debug: true,
          output: "./notes-out",
          supabase: "/tmp/supabase.json",
          timeout: "30s",
          "transcript-output": "./transcripts-out",
        },
        null,
        2,
      ),
      "utf8",
    );

    const config = await loadConfig({
      env: { NODE_ENV: "test" },
      globalFlags: { config: configPath },
      subcommandFlags: {},
    });

    expect(config.configFileUsed).toBe(configPath);
    expect(config.debug).toBe(true);
    expect(config.supabase).toBe("/tmp/supabase.json");
    expect(config.notes.output).toBe(join(directory, "notes-out"));
    expect(config.notes.timeoutMs).toBe(30_000);
    expect(config.transcripts.cacheFile).toBe("/tmp/cache.json");
    expect(config.transcripts.output).toBe(join(directory, "transcripts-out"));
    expect(config.agents).toEqual(
      expect.objectContaining({
        codexCommand: "codex-beta",
        defaultModel: "openai/gpt-5-mini",
        defaultProvider: "openrouter",
        dryRun: true,
        harnessesFile: join(directory, "agent-harnesses.json"),
        maxRetries: 4,
        timeoutMs: 45_000,
      }),
    );
  });

  test("throws a clean error when an explicit config file is missing", async () => {
    const configPath = join(tmpdir(), "gran-missing-config.json");

    await expect(
      loadConfig({
        env: { NODE_ENV: "test" },
        globalFlags: { config: configPath },
        subcommandFlags: {},
      }),
    ).rejects.toThrow(`config file not found: ${configPath}`);
  });
});
