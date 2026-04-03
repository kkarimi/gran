import { describe, expect, test } from "vite-plus/test";

import { convertProseMirrorToMarkdown } from "../src/prosemirror.ts";

describe("convertProseMirrorToMarkdown", () => {
  test("renders nested bullet lists", () => {
    const markdown = convertProseMirrorToMarkdown({
      content: [
        {
          content: [
            {
              content: [
                {
                  content: [{ text: "Parent item", type: "text" }],
                  type: "paragraph",
                },
                {
                  content: [
                    {
                      content: [
                        {
                          content: [{ text: "Nested item", type: "text" }],
                          type: "paragraph",
                        },
                      ],
                      type: "listItem",
                    },
                  ],
                  type: "bulletList",
                },
              ],
              type: "listItem",
            },
          ],
          type: "bulletList",
        },
      ],
      type: "doc",
    });

    expect(markdown).toContain("- Parent item");
    expect(markdown).toContain("  - Nested item");
  });

  test("renders inline marks", () => {
    const markdown = convertProseMirrorToMarkdown({
      content: [
        {
          content: [
            {
              marks: [{ type: "strong" }],
              text: "Bold",
              type: "text",
            },
            {
              text: " ",
              type: "text",
            },
            {
              marks: [{ attrs: { href: "https://example.com" }, type: "link" }],
              text: "Link",
              type: "text",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    });

    expect(markdown).toContain("**Bold**");
    expect(markdown).toContain("[Link](https://example.com)");
  });
});
