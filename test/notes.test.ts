import { describe, expect, test } from "vite-plus/test";

import { documentToMarkdown } from "../src/notes.ts";

describe("documentToMarkdown", () => {
  test("prefers ProseMirror content and writes YAML frontmatter", () => {
    const markdown = documentToMarkdown({
      content: "fallback content",
      createdAt: "2024-01-01T00:00:00Z",
      id: "doc-1",
      notes: {
        content: [
          { attrs: { level: 2 }, content: [{ text: "Key Points", type: "text" }], type: "heading" },
          {
            content: [
              {
                content: [{ text: "First item", type: "text" }],
                type: "listItem",
              },
            ],
            type: "bulletList",
          },
        ],
        type: "doc",
      },
      notesPlain: "",
      tags: ["work", "planning"],
      title: "Team Sync",
      updatedAt: "2024-01-02T00:00:00Z",
    });

    expect(markdown).toContain('id: "doc-1"');
    expect(markdown).toContain("# Team Sync");
    expect(markdown).toContain("## Key Points");
    expect(markdown).toContain("- First item");
    expect(markdown).not.toContain("fallback content");
  });

  test("falls back to HTML conversion when ProseMirror is unavailable", () => {
    const markdown = documentToMarkdown({
      content: "",
      createdAt: "2024-01-01T00:00:00Z",
      id: "doc-2",
      lastViewedPanel: {
        originalContent: "<h2>Summary</h2><ul><li>Point one</li><li>Point two</li></ul>",
      },
      notesPlain: "",
      tags: [],
      title: "HTML note",
      updatedAt: "2024-01-02T00:00:00Z",
    });

    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("- Point one");
    expect(markdown).toContain("- Point two");
  });
});
