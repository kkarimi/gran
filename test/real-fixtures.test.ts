import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { parseCacheContents } from "../src/cache.ts";
import { fetchDocuments } from "../src/api.ts";
import { writeNotes } from "../src/notes.ts";
import { writeTranscripts } from "../src/transcripts.ts";

const supabaseFixtureUrl = new URL("./fixtures/granola-supabase.fixture.json", import.meta.url);
const documentsFixtureUrl = new URL(
  "./fixtures/granola-documents-page.fixture.json",
  import.meta.url,
);
const cacheFixtureUrl = new URL("./fixtures/granola-cache-v6.fixture.json", import.meta.url);

describe("sanitised real Granola fixtures", () => {
  test("exports notes from a captured documents response fixture", async () => {
    const supabaseContents = await readFile(supabaseFixtureUrl, "utf8");
    const documentsPayload = await readFile(documentsFixtureUrl, "utf8");
    const outputDir = await mkdtemp(join(tmpdir(), "granola-toolkit-fixture-notes-"));
    const calls: Array<{ auth?: string; offset: number }> = [];

    const documents = await fetchDocuments({
      fetchImpl: async (_url, init) => {
        if (typeof init?.body !== "string") {
          throw new Error("expected request body to be a string");
        }

        const body = JSON.parse(init.body) as { offset: number };
        const headers = new Headers(init.headers);
        calls.push({
          auth: headers.get("authorization") ?? undefined,
          offset: body.offset,
        });

        return new Response(documentsPayload, { status: 200 });
      },
      supabaseContents,
      timeoutMs: 5_000,
      url: "https://example.test/documents",
    });

    expect(calls).toEqual([
      {
        auth: "Bearer fixture-workos-access-token",
        offset: 0,
      },
    ]);
    expect(documents).toHaveLength(1);
    expect(documents[0]?.lastViewedPanel?.title).toBe("Summary");

    expect(await writeNotes(documents, outputDir)).toBe(1);

    const noteOutput = await readFile(join(outputDir, "Fixture Payment Ops.md"), "utf8");
    expect(noteOutput).toContain("# Fixture Payment Ops");
    expect(noteOutput).toContain("### Fixture heading");
    expect(noteOutput).toContain("- Fixture bullet");
  });

  test("exports transcripts from a captured cache fixture", async () => {
    const cacheContents = await readFile(cacheFixtureUrl, "utf8");
    const outputDir = await mkdtemp(join(tmpdir(), "granola-toolkit-fixture-transcripts-"));
    const cacheData = parseCacheContents(cacheContents);

    expect(cacheData.documents["fixture-cache-doc-1"]?.title).toBe("Fixture Cache Meeting");
    expect(cacheData.transcripts["fixture-cache-doc-1"]).toHaveLength(3);

    expect(await writeTranscripts(cacheData, outputDir)).toBe(1);

    const transcriptOutput = await readFile(join(outputDir, "Fixture Cache Meeting.txt"), "utf8");
    expect(transcriptOutput).toContain("Fixture Cache Meeting");
    expect(transcriptOutput).toContain("[08:45:18] System: Link.");
    expect(transcriptOutput).toContain("[08:45:19] You: Alright.");
    expect(transcriptOutput).toContain("[08:45:30] System: Hey, team. Morning.");
  });
});
