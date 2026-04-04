import { describe, expect, test } from "vite-plus/test";

import { buildSearchIndex, searchSearchIndex } from "../src/search-index.ts";
import type { GranolaDocument } from "../src/types.ts";

const documents: GranolaDocument[] = [
  {
    content: "Fallback note body",
    createdAt: "2024-01-01T09:00:00Z",
    id: "doc-alpha-1111",
    notesPlain: "Discussed customer retention and onboarding timeline",
    tags: ["team", "customer"],
    title: "Alpha Sync",
    updatedAt: "2024-01-03T10:00:00Z",
  },
  {
    content: "Fallback note body",
    createdAt: "2024-01-02T09:00:00Z",
    id: "doc-bravo-2222",
    notesPlain: "Quarterly pipeline review",
    tags: ["sales"],
    title: "Bravo Review",
    updatedAt: "2024-01-04T10:00:00Z",
  },
];

describe("search index", () => {
  test("builds searchable entries with notes, transcripts, folders, and tags", () => {
    const entries = buildSearchIndex(documents, {
      cacheData: {
        documents: {},
        transcripts: {
          "doc-alpha-1111": [
            {
              documentId: "doc-alpha-1111",
              endTimestamp: "2024-01-01T09:00:03Z",
              id: "segment-1",
              isFinal: true,
              source: "microphone",
              startTimestamp: "2024-01-01T09:00:01Z",
              text: "Customer onboarding needs follow-up",
            },
          ],
        },
      },
      foldersByDocumentId: new Map([
        [
          "doc-alpha-1111",
          [
            {
              createdAt: "2024-01-01T08:00:00Z",
              documentCount: 1,
              id: "folder-team-1111",
              isFavourite: true,
              name: "Team",
              updatedAt: "2024-01-04T10:00:00Z",
            },
          ],
        ],
      ]),
    });

    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: "doc-bravo-2222",
      }),
    );
    expect(entries[1]).toEqual(
      expect.objectContaining({
        folderNames: ["Team"],
        transcriptLoaded: true,
      }),
    );
  });

  test("searches across note text, transcript text, folder names, and tags", () => {
    const entries = buildSearchIndex(documents, {
      cacheData: {
        documents: {},
        transcripts: {
          "doc-alpha-1111": [
            {
              documentId: "doc-alpha-1111",
              endTimestamp: "2024-01-01T09:00:03Z",
              id: "segment-1",
              isFinal: true,
              source: "microphone",
              startTimestamp: "2024-01-01T09:00:01Z",
              text: "Customer onboarding needs follow-up",
            },
          ],
        },
      },
      foldersByDocumentId: new Map([
        [
          "doc-alpha-1111",
          [
            {
              createdAt: "2024-01-01T08:00:00Z",
              documentCount: 1,
              id: "folder-team-1111",
              isFavourite: true,
              name: "Team",
              updatedAt: "2024-01-04T10:00:00Z",
            },
          ],
        ],
      ]),
    });

    expect(searchSearchIndex(entries, "customer onboarding")[0]).toEqual({
      id: "doc-alpha-1111",
      score: expect.any(Number),
    });
    expect(searchSearchIndex(entries, "sales")[0]?.id).toBe("doc-bravo-2222");
    expect(searchSearchIndex(entries, "team")[0]?.id).toBe("doc-alpha-1111");
  });
});
