import type { GranolaPluginCapability, GranolaPluginDefinition } from "../plugin-registry.ts";

import type { GranolaAppPluginState, GranolaAppPluginsState } from "./types.ts";

function clonePluginState(plugin: GranolaAppPluginState): GranolaAppPluginState {
  return {
    ...plugin,
    capabilities: [...plugin.capabilities],
  };
}

export function buildPluginState(
  definition: GranolaPluginDefinition,
  enabled: boolean,
): GranolaAppPluginState {
  return {
    capabilities: [...definition.capabilities],
    configurable: definition.configurable,
    description: definition.description,
    enabled,
    id: definition.id,
    label: definition.label,
    shipped: definition.shipped,
  };
}

export function buildPluginsState(
  definitions: GranolaPluginDefinition[],
  enabledById: Record<string, boolean>,
): GranolaAppPluginsState {
  return {
    items: definitions.map((definition) =>
      buildPluginState(definition, enabledById[definition.id] ?? definition.defaultEnabled),
    ),
    loaded: true,
  };
}

export function clonePluginsState(state: GranolaAppPluginsState): GranolaAppPluginsState {
  return {
    items: state.items.map(clonePluginState),
    loaded: state.loaded,
  };
}

export function findPluginState(
  state: GranolaAppPluginsState | null | undefined,
  id: string,
): GranolaAppPluginState | undefined {
  return state?.items.find((plugin) => plugin.id === id);
}

export function isPluginEnabled(
  state: GranolaAppPluginsState | null | undefined,
  id: string,
  fallback = false,
): boolean {
  return findPluginState(state, id)?.enabled ?? fallback;
}

export function pluginSupportsCapability(
  plugin: GranolaAppPluginState | null | undefined,
  capability: GranolaPluginCapability,
): boolean {
  return plugin?.capabilities.includes(capability) ?? false;
}

export function isPluginCapabilityEnabled(
  state: GranolaAppPluginsState | null | undefined,
  capability: GranolaPluginCapability,
  fallback = false,
): boolean {
  const matchingPlugins = state?.items.filter((plugin) =>
    pluginSupportsCapability(plugin, capability),
  );
  if (!matchingPlugins?.length) {
    return fallback;
  }

  return matchingPlugins.some((plugin) => plugin.enabled);
}
