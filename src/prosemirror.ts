import type { ProseMirrorDoc, ProseMirrorMark, ProseMirrorNode } from "./types.ts";

function repeatIndent(level: number): string {
  return "  ".repeat(level);
}

function renderInline(nodes: ProseMirrorNode[] = []): string {
  return nodes.map((node) => renderInlineNode(node)).join("");
}

function applyMarks(text: string, marks: ProseMirrorMark[] = []): string {
  return marks.reduce((current, mark) => {
    switch (mark.type) {
      case "strong":
        return `**${current}**`;
      case "em":
        return `*${current}*`;
      case "code":
        return `\`${current}\``;
      case "strike":
        return `~~${current}~~`;
      case "link": {
        const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : undefined;
        return href ? `[${current}](${href})` : current;
      }
      default:
        return current;
    }
  }, text);
}

function renderInlineNode(node: ProseMirrorNode): string {
  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks);
    case "hardBreak":
      return "  \n";
    default:
      return applyMarks(renderInline(node.content), node.marks);
  }
}

function indentLines(value: string, level: number): string {
  const indent = repeatIndent(level);
  return value
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${indent}${line}`))
    .join("\n");
}

function renderList(items: ProseMirrorNode[], ordered: boolean, indentLevel: number): string {
  return items
    .map((item, index) => renderListItem(item, ordered ? `${index + 1}.` : "-", indentLevel))
    .join("\n");
}

function renderListItem(node: ProseMirrorNode, marker: string, indentLevel: number): string {
  const children = node.content ?? [];
  const blockChildren = children.filter(
    (child) => child.type !== "bulletList" && child.type !== "orderedList",
  );
  const nestedLists = children.filter(
    (child) => child.type === "bulletList" || child.type === "orderedList",
  );

  const mainText = blockChildren
    .map((child) => renderBlock(child, indentLevel + 1))
    .filter(Boolean)
    .join("\n")
    .trim();

  const prefix = `${repeatIndent(indentLevel)}${marker} `;
  let output = `${prefix}${mainText || ""}`.trimEnd();

  if (nestedLists.length > 0) {
    const nestedText = nestedLists
      .map((child) => renderBlock(child, indentLevel + 1))
      .filter(Boolean)
      .map((value) => indentLines(value, 0))
      .join("\n");

    output = `${output}\n${nestedText}`;
  }

  return output;
}

function renderBlock(node: ProseMirrorNode, indentLevel: number): string {
  switch (node.type) {
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      return `${"#".repeat(level)} ${renderInline(node.content).trim()}`.trim();
    }
    case "paragraph":
      return renderInline(node.content).trim();
    case "bulletList":
      return renderList(node.content ?? [], false, indentLevel);
    case "orderedList":
      return renderList(node.content ?? [], true, indentLevel);
    case "listItem":
      return renderListItem(node, "-", indentLevel);
    case "blockquote": {
      const value = renderBlocks(node.content ?? [], indentLevel)
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
      return value.trim();
    }
    case "codeBlock": {
      const text = extractPlainText(node).trimEnd();
      return `\`\`\`\n${text}\n\`\`\``;
    }
    case "horizontalRule":
      return "---";
    case "hardBreak":
      return "";
    case "text":
      return renderInlineNode(node);
    default:
      if (node.content?.length) {
        return renderBlocks(node.content, indentLevel);
      }

      return renderInlineNode(node).trim();
  }
}

function renderBlocks(nodes: ProseMirrorNode[], indentLevel = 0): string {
  return nodes
    .map((node) => renderBlock(node, indentLevel))
    .filter((value) => value.length > 0)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPlainTextNode(node: ProseMirrorNode): string {
  switch (node.type) {
    case "hardBreak":
      return "\n";
    case "text":
      return node.text ?? "";
    default:
      return extractPlainText({ type: "doc", content: node.content });
  }
}

export function convertProseMirrorToMarkdown(doc?: ProseMirrorDoc): string {
  if (!doc || doc.type !== "doc" || !doc.content?.length) {
    return "";
  }

  const rendered = renderBlocks(doc.content);
  return rendered ? `${rendered}\n` : "";
}

export function extractPlainText(doc?: ProseMirrorDoc): string {
  if (!doc || doc.type !== "doc" || !doc.content?.length) {
    return "";
  }

  const lines = doc.content
    .map((node) => {
      if (node.type === "bulletList" || node.type === "orderedList") {
        return (node.content ?? [])
          .map((child) => extractPlainTextNode(child))
          .filter(Boolean)
          .join("\n");
      }

      return extractPlainTextNode(node);
    })
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return lines;
}
