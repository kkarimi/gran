export const GRANOLA_AUTOMATION_PLUGIN_ID = "automation";
export const GRANOLA_MARKDOWN_VIEWER_PLUGIN_ID = "markdown-viewer";

export type GranolaPluginCapability = "automation" | "markdown-rendering";

export interface GranolaPluginDefinition {
  capabilities: GranolaPluginCapability[];
  configurable: boolean;
  defaultEnabled: boolean;
  description: string;
  id: string;
  label: string;
  shipped: boolean;
}

export interface GranolaPluginRegistry {
  getPlugin(id: string): GranolaPluginDefinition | undefined;
  listPlugins(): GranolaPluginDefinition[];
}

function clonePluginDefinition(definition: GranolaPluginDefinition): GranolaPluginDefinition {
  return {
    ...definition,
    capabilities: [...definition.capabilities],
  };
}

const builtInPlugins: GranolaPluginDefinition[] = [
  {
    capabilities: ["automation"],
    configurable: true,
    defaultEnabled: false,
    description:
      "Generate reviewable notes and enrichments, run harnesses, and process post-meeting automations.",
    id: GRANOLA_AUTOMATION_PLUGIN_ID,
    label: "Automation",
    shipped: true,
  },
  {
    capabilities: ["markdown-rendering"],
    configurable: true,
    defaultEnabled: true,
    description:
      "Render meeting notes and markdown artefacts as readable documents in the browser while keeping the raw markdown available.",
    id: GRANOLA_MARKDOWN_VIEWER_PLUGIN_ID,
    label: "Markdown Viewer",
    shipped: true,
  },
];

export class StaticGranolaPluginRegistry implements GranolaPluginRegistry {
  #pluginsById: Map<string, GranolaPluginDefinition>;

  constructor(private readonly plugins: GranolaPluginDefinition[]) {
    this.#pluginsById = new Map(
      plugins.map((plugin) => [plugin.id, clonePluginDefinition(plugin)]),
    );
  }

  getPlugin(id: string): GranolaPluginDefinition | undefined {
    const plugin = this.#pluginsById.get(id);
    return plugin ? clonePluginDefinition(plugin) : undefined;
  }

  listPlugins(): GranolaPluginDefinition[] {
    return this.plugins.map(clonePluginDefinition);
  }
}

export function createDefaultPluginRegistry(): GranolaPluginRegistry {
  return new StaticGranolaPluginRegistry(builtInPlugins);
}

export function defaultPluginDefinitions(): GranolaPluginDefinition[] {
  return builtInPlugins.map(clonePluginDefinition);
}

export function defaultPluginEnabledMap(
  definitions: GranolaPluginDefinition[] = defaultPluginDefinitions(),
): Record<string, boolean> {
  return Object.fromEntries(
    definitions.map((definition) => [definition.id, definition.defaultEnabled]),
  );
}
