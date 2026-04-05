import { describe, expect, test } from "vite-plus/test";

import { buildPipelineInstructions, parsePipelineOutput } from "../src/processing.ts";

describe("processing pipelines", () => {
  test("adds structured output instructions for notes pipelines", () => {
    expect(buildPipelineInstructions("notes", "Make this crisp.")).toContain("Return JSON only.");
    expect(buildPipelineInstructions("notes", "Make this crisp.")).toContain("markdown");
  });

  test("parses JSON pipeline output", () => {
    const result = parsePipelineOutput({
      kind: "notes",
      meetingTitle: "Alpha Sync",
      rawOutput: JSON.stringify({
        actionItems: [{ owner: "Nima", title: "Send recap" }],
        decisions: ["Ship it"],
        followUps: ["Confirm date"],
        highlights: ["Budget approved"],
        markdown: "# Alpha\n\n## Summary\n\nShipped.",
        metadata: { source: "model" },
        sections: [{ body: "Shipped.", title: "Summary" }],
        summary: "Shipped.",
        title: "Alpha",
      }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        parseMode: "json",
        structured: expect.objectContaining({
          actionItems: [expect.objectContaining({ title: "Send recap" })],
          title: "Alpha",
        }),
      }),
    );
  });

  test("falls back to markdown when the model does not return JSON", () => {
    const result = parsePipelineOutput({
      kind: "enrichment",
      meetingTitle: "Alpha Sync",
      rawOutput: "# Alpha\n\nFollow up with finance.",
    });

    expect(result).toEqual(
      expect.objectContaining({
        parseMode: "markdown-fallback",
        structured: expect.objectContaining({
          summary: "Alpha",
          title: "Alpha Sync Enrichment",
        }),
      }),
    );
  });
});
