import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { FileAutomationArtefactStore } from "../src/automation-artefacts.ts";
import type { GranolaAutomationArtefact } from "../src/app/index.ts";

function buildArtefact(
  id: string,
  overrides: Partial<GranolaAutomationArtefact> = {},
): GranolaAutomationArtefact {
  return {
    actionId: "pipeline-notes",
    actionName: "Pipeline notes",
    attempts: [],
    createdAt: "2024-03-01T12:00:00.000Z",
    eventId: "sync-1",
    id,
    kind: "notes",
    matchId: "sync-1:team-transcript",
    meetingId: "doc-alpha-1111",
    model: "gpt-5-codex",
    parseMode: "json",
    prompt: "Prompt",
    provider: "codex",
    rawOutput: '{"title":"Alpha"}',
    ruleId: "team-transcript",
    ruleName: "Team transcript ready",
    runId: "sync-1:team-transcript:pipeline-notes",
    status: "generated",
    structured: {
      actionItems: [],
      decisions: [],
      followUps: [],
      highlights: [],
      markdown: "# Alpha",
      sections: [{ body: "Alpha body", title: "Summary" }],
      summary: "Alpha body",
      title: "Alpha",
    },
    updatedAt: "2024-03-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("automation artefact store", () => {
  test("writes and filters artefacts", async () => {
    const filePath = join(
      await mkdtemp(join(tmpdir(), "granola-automation-artefacts-")),
      "artefacts.json",
    );
    const store = new FileAutomationArtefactStore(filePath);

    await store.writeArtefacts([
      buildArtefact("notes-1"),
      buildArtefact("enrichment-1", {
        kind: "enrichment",
        meetingId: "doc-beta-2222",
        status: "approved",
        updatedAt: "2024-03-01T13:00:00.000Z",
      }),
    ]);

    expect(await store.readArtefact("notes-1")).toEqual(
      expect.objectContaining({
        id: "notes-1",
        kind: "notes",
      }),
    );
    expect(await store.readArtefacts({ kind: "enrichment", limit: 10 })).toEqual([
      expect.objectContaining({
        id: "enrichment-1",
      }),
    ]);
    expect(
      await store.readArtefacts({
        meetingId: "doc-alpha-1111",
        status: "generated",
      }),
    ).toEqual([
      expect.objectContaining({
        id: "notes-1",
      }),
    ]);
  });
});
