import { describe, expect, test } from "vite-plus/test";

import { renderMarkdownDocument } from "../src/web-app/markdown-viewer.tsx";

describe("renderMarkdownDocument", () => {
  test("renders readable markdown HTML", () => {
    const html = renderMarkdownDocument("# Alpha Sync\n\n- First item\n- Second item");

    expect(html).toContain("<h1>Alpha Sync</h1>");
    expect(html).toContain("<li>First item</li>");
    expect(html).toContain("<li>Second item</li>");
  });

  test("escapes inline html and drops unsafe links", () => {
    const html = renderMarkdownDocument(
      'Intro <script>alert("x")</script>\n\n[Unsafe](javascript:alert(1))\n\n[Safe](https://example.com)',
    );

    expect(html).toContain("&lt;script&gt;alert(");
    expect(html).toContain("&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:alert(1)");
    expect(html).toContain("<span>Unsafe</span>");
    expect(html).toContain('href="https://example.com"');
  });

  test("returns an empty-state paragraph for blank markdown", () => {
    const html = renderMarkdownDocument("   \n");

    expect(html).toContain("markdown-document__empty");
    expect(html).toContain("(No markdown available)");
  });
});
