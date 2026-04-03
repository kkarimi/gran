import { describe, expect, test } from "vite-plus/test";

import { formatTranscript } from "../src/transcripts.ts";

describe("formatTranscript", () => {
  test("formats transcript segments with speaker labels", () => {
    const output = formatTranscript(
      {
        createdAt: "2024-01-01T00:00:00Z",
        id: "doc-1",
        title: "Team Sync",
        updatedAt: "2024-01-01T01:00:00Z",
      },
      [
        {
          documentId: "doc-1",
          endTimestamp: "2024-01-01T10:00:05Z",
          id: "seg-1",
          isFinal: true,
          source: "system",
          startTimestamp: "2024-01-01T10:00:00Z",
          text: "Morning everyone",
        },
        {
          documentId: "doc-1",
          endTimestamp: "2024-01-01T10:00:10Z",
          id: "seg-2",
          isFinal: true,
          source: "microphone",
          startTimestamp: "2024-01-01T10:00:06Z",
          text: "Morning",
        },
      ],
    );

    expect(output).toContain("Team Sync");
    expect(output).toContain("[10:00:00] System: Morning everyone");
    expect(output).toContain("[10:00:06] You: Morning");
  });

  test("preserves the timestamp clock time instead of converting to UTC", () => {
    const output = formatTranscript(
      {
        createdAt: "",
        id: "doc-2",
        title: "Offset Meeting",
        updatedAt: "",
      },
      [
        {
          documentId: "doc-2",
          endTimestamp: "2024-01-01T10:00:05+02:00",
          id: "seg-1",
          isFinal: true,
          source: "system",
          startTimestamp: "2024-01-01T10:00:00+02:00",
          text: "Local time",
        },
      ],
    );

    expect(output).toContain("[10:00:00] System: Local time");
  });
});
