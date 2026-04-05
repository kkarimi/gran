import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { readAutomationEvaluationCases } from "../src/evaluations.ts";

const fixtureBundle = {
  document: {
    content: "",
    createdAt: "2024-01-01T09:00:00Z",
    id: "doc-alpha-1111",
    notesPlain: "Existing notes",
    tags: ["team"],
    title: "Alpha Sync",
    updatedAt: "2024-01-03T10:00:00Z",
  },
  meeting: {
    meeting: {
      createdAt: "2024-01-01T09:00:00Z",
      folders: [],
      id: "doc-alpha-1111",
      noteContentSource: "notes",
      tags: ["team"],
      title: "Alpha Sync",
      transcriptLoaded: true,
      transcriptSegmentCount: 1,
      updatedAt: "2024-01-03T10:00:00Z",
    },
    note: {
      content: "Existing notes",
      contentSource: "notes",
      createdAt: "2024-01-01T09:00:00Z",
      id: "doc-alpha-1111",
      tags: ["team"],
      title: "Alpha Sync",
      updatedAt: "2024-01-03T10:00:00Z",
    },
    noteMarkdown: "# Alpha Sync",
    roleHelpers: {
      ownerCandidates: [{ id: "self", label: "You", role: "self", source: "speaker" }],
      participants: [],
      speakers: [
        {
          firstTimestamp: "2024-01-01T09:00:01Z",
          id: "speaker:you",
          label: "You",
          lastTimestamp: "2024-01-01T09:00:03Z",
          role: "self",
          segmentCount: 1,
          source: "microphone",
          wordCount: 2,
        },
      ],
    },
    transcript: null,
    transcriptText: "You: Hello team",
  },
};

describe("automation evaluations", () => {
  test("reads a single bundle fixture file", async () => {
    const filePath = join(await mkdtemp(join(tmpdir(), "granola-eval-fixture-")), "case.json");
    await writeFile(filePath, `${JSON.stringify(fixtureBundle)}\n`, "utf8");

    await expect(readAutomationEvaluationCases(filePath)).resolves.toEqual([
      expect.objectContaining({
        id: "doc-alpha-1111",
        title: "Alpha Sync",
      }),
    ]);
  });

  test("reads directory fixtures with case wrappers", async () => {
    const dirPath = await mkdtemp(join(tmpdir(), "granola-eval-dir-"));
    await writeFile(
      join(dirPath, "customer.json"),
      `${JSON.stringify({
        cases: [
          {
            bundle: fixtureBundle,
            id: "customer-sync",
            title: "Customer Sync",
          },
        ],
      })}\n`,
      "utf8",
    );

    await expect(readAutomationEvaluationCases(dirPath)).resolves.toEqual([
      expect.objectContaining({
        id: "customer-sync",
        title: "Customer Sync",
      }),
    ]);
  });
});
