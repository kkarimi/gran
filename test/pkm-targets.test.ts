import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { FilePkmTargetStore } from "../src/pkm-targets.ts";

describe("pkm targets", () => {
  test("loads targets from a JSON file", async () => {
    const filePath = join(await mkdtemp(join(tmpdir(), "granola-pkm-targets-")), "targets.json");
    const store = new FilePkmTargetStore(filePath);

    await store.writeTargets([
      {
        folderSubdirectories: true,
        id: "obsidian-team",
        kind: "obsidian",
        outputDir: "/tmp/vault/team",
      },
      {
        frontmatter: false,
        id: "docs-folder",
        kind: "docs-folder",
        name: "Docs folder",
        outputDir: "/tmp/docs",
      },
    ]);

    expect(await store.readTargets()).toEqual([
      expect.objectContaining({
        folderSubdirectories: true,
        id: "obsidian-team",
        kind: "obsidian",
      }),
      expect.objectContaining({
        frontmatter: false,
        id: "docs-folder",
        kind: "docs-folder",
      }),
    ]);
    expect(await readFile(filePath, "utf8")).toContain('"obsidian-team"');
  });
});
