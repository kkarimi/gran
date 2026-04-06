/** @jsxImportSource solid-js */

import { createMemo, type JSX } from "solid-js";

import { Marked, Renderer } from "marked";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return trimmed;
    }
  } catch {}

  return null;
}

const renderer = new Renderer();
renderer.html = ({ text }) => escapeHtml(text);
renderer.link = function ({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  const safe = safeHref(href);
  if (!safe) {
    return `<span>${text}</span>`;
  }

  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeHtml(safe)}"${titleAttribute} target="_blank" rel="noreferrer">${text}</a>`;
};

const markdownParser = new Marked({
  async: false,
  breaks: true,
  gfm: true,
  renderer,
});

export function renderMarkdownDocument(markdown: string): string {
  const source = markdown.trim();
  if (!source) {
    return '<p class="markdown-document__empty">(No markdown available)</p>';
  }

  return markdownParser.parse(source) as string;
}

export function MarkdownDocument(props: { markdown: string }): JSX.Element {
  const html = createMemo(() => renderMarkdownDocument(props.markdown));

  return <div class="markdown-document" innerHTML={html()} />;
}
