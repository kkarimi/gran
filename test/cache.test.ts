import { describe, expect, test } from "vite-plus/test";

import { parseCacheContents } from "../src/cache.ts";

describe("parseCacheContents", () => {
  test("parses double-encoded cache payloads", () => {
    const contents = JSON.stringify({
      cache: JSON.stringify({
        state: {
          documents: {
            "doc-1": {
              created_at: "2024-01-01T00:00:00Z",
              title: "Meeting",
              updated_at: "2024-01-02T00:00:00Z",
            },
          },
          transcripts: {
            "doc-1": [
              {
                document_id: "doc-1",
                end_timestamp: "2024-01-01T10:00:05Z",
                id: "seg-1",
                is_final: true,
                source: "microphone",
                start_timestamp: "2024-01-01T10:00:00Z",
                text: "Hello",
              },
            ],
          },
        },
      }),
    });

    const cache = parseCacheContents(contents);
    expect(cache.documents["doc-1"]?.title).toBe("Meeting");
    expect(cache.transcripts["doc-1"]?.[0]?.source).toBe("microphone");
  });

  test("parses direct-object cache payloads", () => {
    const contents = JSON.stringify({
      cache: {
        state: {
          documents: {},
          transcripts: {},
        },
      },
    });

    const cache = parseCacheContents(contents);
    expect(cache.documents).toEqual({});
    expect(cache.transcripts).toEqual({});
  });
});
