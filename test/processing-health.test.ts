import { describe, expect, test } from "vite-plus/test";

import { buildProcessingIssues, parseProcessingIssueId } from "../src/processing-health.ts";

describe("processing health", () => {
  test("detects sync and pipeline failures and parses issue ids", () => {
    const issues = buildProcessingIssues({
      artefacts: [],
      meetings: [
        {
          createdAt: "2024-03-01T11:30:00.000Z",
          folders: [],
          id: "doc-alpha-1111",
          noteContentSource: "notes",
          tags: ["team"],
          title: "Alpha Sync",
          transcriptLoaded: true,
          transcriptSegmentCount: 4,
          updatedAt: "2024-03-01T12:30:00.000Z",
        },
      ],
      nowIso: "2024-03-01T13:00:00.000Z",
      rules: [
        {
          actions: [
            {
              id: "pipeline-notes",
              kind: "agent",
              pipeline: {
                kind: "notes",
              },
              prompt: "Summarise the transcript.",
            },
          ],
          id: "team-transcript",
          name: "Team transcript ready",
          when: {
            eventKinds: ["transcript.ready"],
            transcriptLoaded: true,
          },
        },
      ],
      runs: [
        {
          actionId: "pipeline-notes",
          actionKind: "agent",
          actionName: "pipeline-notes",
          error: "provider timeout",
          eventId: "sync-1:transcript.ready",
          eventKind: "transcript.ready",
          folders: [],
          id: "sync-1:team-transcript:pipeline-notes",
          matchId: "sync-1:team-transcript",
          matchedAt: "2024-03-01T12:30:00.000Z",
          meetingId: "doc-alpha-1111",
          ruleId: "team-transcript",
          ruleName: "Team transcript ready",
          startedAt: "2024-03-01T12:30:00.000Z",
          status: "failed",
          tags: ["team"],
          title: "Alpha Sync",
          transcriptLoaded: true,
        },
      ],
      syncState: {
        eventCount: 0,
        lastChanges: [],
        lastCompletedAt: "2024-03-01T11:00:00.000Z",
        running: false,
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sync-stale:::",
          kind: "sync-stale",
        }),
        expect.objectContaining({
          id: "pipeline-failed:doc-alpha-1111:team-transcript:pipeline-notes",
          kind: "pipeline-failed",
        }),
      ]),
    );
    expect(
      parseProcessingIssueId("pipeline-failed:doc-alpha-1111:team-transcript:pipeline-notes"),
    ).toEqual({
      actionId: "pipeline-notes",
      kind: "pipeline-failed",
      meetingId: "doc-alpha-1111",
      ruleId: "team-transcript",
    });
  });
});
