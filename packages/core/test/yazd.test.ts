import { describe, expect, it } from "vitest";

import {
  createGranolaYazdAgentPlugin,
  listGranolaYazdKnowledgeBasePluginDefinitions,
} from "../src/yazd.ts";

describe("@kkarimi/gran-core/yazd", () => {
  it("exports the Yazd agent bridge from the explicit subpath", async () => {
    const plugin = createGranolaYazdAgentPlugin({
      config: {
        agents: {
          codexCommand: "codex",
          defaultProvider: "codex",
          dryRun: false,
          harnessesFile: "/tmp/agent-harnesses.json",
          maxRetries: 2,
          openaiBaseUrl: "https://api.openai.com/v1",
          openrouterBaseUrl: "https://openrouter.ai/api/v1",
          timeoutMs: 30_000,
        },
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
      provider: "codex",
      runner: {
        async run() {
          return {
            dryRun: false,
            model: "gpt-5-codex",
            output: "ok",
            prompt: "ignored",
            provider: "codex",
          };
        },
      },
    });

    const result = await plugin.run({ prompt: "Summarise this meeting." });
    expect(result.text).toBe("ok");
  });

  it("exports Yazd knowledge-base definitions from the explicit subpath", () => {
    const definitions = listGranolaYazdKnowledgeBasePluginDefinitions();

    expect(definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gran-markdown-vault",
          managedBy: "gran",
        }),
        expect.objectContaining({
          id: "yazd-notion",
          managedBy: "yazd",
        }),
      ]),
    );
  });
});
