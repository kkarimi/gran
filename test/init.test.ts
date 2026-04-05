import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, test } from "vite-plus/test";

import { initialiseGranolaToolkitProject } from "../src/init.ts";

describe("initialiseGranolaToolkitProject", () => {
  test("creates a local bootstrap with starter config, harnesses, rules, and prompts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "granola-toolkit-init-"));

    const result = await initialiseGranolaToolkitProject({
      directory,
      provider: "openrouter",
    });

    expect(result.configPath).toBe(join(directory, ".granola.toml"));
    expect(result.createdFiles).toEqual([
      join(directory, ".granola.toml"),
      join(directory, ".granola", "agent-harnesses.json"),
      join(directory, ".granola", "automation-rules.json"),
      join(directory, ".granola", "pkm-targets.json"),
      join(directory, ".granola", "prompts", "team-notes.md"),
      join(directory, ".granola", "prompts", "customer-follow-up.md"),
    ]);

    const configContents = await readFile(join(directory, ".granola.toml"), "utf8");
    const harnessContents = await readFile(
      join(directory, ".granola", "agent-harnesses.json"),
      "utf8",
    );
    const rulesContents = await readFile(
      join(directory, ".granola", "automation-rules.json"),
      "utf8",
    );

    expect(configContents).toContain('agent-provider = "openrouter"');
    expect(configContents).toContain('agent-model = "openai/gpt-5-mini"');
    expect(configContents).toContain('agent-harnesses-file = "./.granola/agent-harnesses.json"');
    expect(harnessContents).toContain('"id": "team-notes"');
    expect(harnessContents).toContain('"promptFile": "./.granola/prompts/team-notes.md"');
    expect(rulesContents).toContain('"harnessId": "team-notes"');
    expect(rulesContents).toContain('"folderNames": [');
  });

  test("refuses to overwrite generated files unless forced", async () => {
    const directory = await mkdtemp(join(tmpdir(), "granola-toolkit-init-"));

    await initialiseGranolaToolkitProject({
      directory,
      provider: "codex",
    });

    await expect(
      initialiseGranolaToolkitProject({
        directory,
        provider: "codex",
      }),
    ).rejects.toThrow("init would overwrite existing files:");
  });
});
