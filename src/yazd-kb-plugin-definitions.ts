import type { GranolaYazdKnowledgeBaseKind } from "./app/types.ts";

export type GranolaYazdKnowledgeBasePluginManager = "gran" | "yazd";
export type GranolaYazdKnowledgeBasePluginTransport = "api" | "filesystem";

export interface GranolaYazdKnowledgeBasePluginDefinition {
  description: string;
  id: string;
  kinds: readonly GranolaYazdKnowledgeBaseKind[];
  label: string;
  managedBy: GranolaYazdKnowledgeBasePluginManager;
  setupHint: string;
  transport: GranolaYazdKnowledgeBasePluginTransport;
}

const defaultDefinitions = [
  {
    description: "Publish reviewable markdown bundles into a local folder or Obsidian vault.",
    id: "gran-markdown-vault",
    kinds: ["folder", "obsidian-vault"],
    label: "Markdown vault",
    managedBy: "gran",
    setupHint: "Manage the path, folders, and daily-note options directly in Gran.",
    transport: "filesystem",
  },
  {
    description:
      "Send reviewed meeting artifacts into a Notion workspace once the destination is configured in Yazd.",
    id: "yazd-notion",
    kinds: ["notion"],
    label: "Notion",
    managedBy: "yazd",
    setupHint: "Configure the workspace, database, and publish rules in Yazd.",
    transport: "api",
  },
  {
    description:
      "Publish reviewed meeting artifacts into Capacities through a Yazd-managed knowledge-base plugin.",
    id: "yazd-capacities",
    kinds: ["capacities"],
    label: "Capacities",
    managedBy: "yazd",
    setupHint: "Configure the workspace, objects, and publish rules in Yazd.",
    transport: "api",
  },
  {
    description:
      "Publish reviewed meeting artifacts into Tana via a Yazd-managed knowledge-base plugin.",
    id: "yazd-tana",
    kinds: ["tana"],
    label: "Tana",
    managedBy: "yazd",
    setupHint: "Configure the workspace, destination node, and publish rules in Yazd.",
    transport: "api",
  },
] as const satisfies readonly GranolaYazdKnowledgeBasePluginDefinition[];

export function listGranolaYazdKnowledgeBasePluginDefinitions(): GranolaYazdKnowledgeBasePluginDefinition[] {
  return defaultDefinitions.map((definition) => ({
    ...definition,
    kinds: [...definition.kinds],
  }));
}

export function resolveGranolaYazdKnowledgeBasePluginDefinition(
  kind: GranolaYazdKnowledgeBaseKind,
): GranolaYazdKnowledgeBasePluginDefinition {
  const match = defaultDefinitions.find((definition) =>
    (definition.kinds as readonly GranolaYazdKnowledgeBaseKind[]).includes(kind),
  );
  if (!match) {
    throw new Error(`no Yazd knowledge-base plugin definition registered for ${kind}`);
  }

  return {
    ...match,
    kinds: [...match.kinds],
  };
}
