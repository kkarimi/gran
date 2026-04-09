import { describe, expect, test } from "vite-plus/test";

import { buildObsidianOpenFileUri, buildObsidianSearchUri } from "../src/obsidian-uri.ts";

describe("obsidian uri helpers", () => {
  test("builds open file URIs using explicit vault names", () => {
    expect(
      buildObsidianOpenFileUri({
        filePath: "Meetings/Team/Launch Review-notes.md",
        target: {
          outputDir: "/tmp/Work",
          vaultName: "Work",
        },
      }),
    ).toBe("obsidian://open?file=Meetings%2FTeam%2FLaunch%20Review-notes.md&vault=Work");
  });

  test("infers vault names from the output directory when none is configured", () => {
    expect(
      buildObsidianSearchUri({
        query: "tag:#team",
        target: {
          name: "Ignored name",
          outputDir: "/Users/example/Vaults/Product",
        },
      }),
    ).toBe("obsidian://search?query=tag%3A%23team&vault=Product");
  });
});
