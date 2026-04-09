import type { SetStoreFunction } from "solid-js/store";

import type { GranolaAppPluginState } from "../app/index.ts";
import { pluginSupportsCapability } from "../app/plugin-state.ts";

import type { GranolaWebAppState } from "./types.ts";

export interface AutomationCapabilityLoader {
  loadAutomationArtefacts(): Promise<unknown>;
  loadPkmTargets(): Promise<unknown>;
  loadAutomationRules(): Promise<unknown>;
  loadAutomationRuns(): Promise<unknown>;
  loadHarnesses(): Promise<unknown>;
  loadProcessingIssues(): Promise<unknown>;
}

export function clearAutomationCapabilityState(
  setState: SetStoreFunction<GranolaWebAppState>,
): void {
  setState("automationArtefacts", []);
  setState("automationArtefactPublishPreview", null);
  setState("automationArtefactPublishPreviewError", "");
  setState("automationArtefactPublishPreviewLoading", false);
  setState("automationRules", []);
  setState("automationRuns", []);
  setState("harnesses", []);
  setState("harnessExplanations", []);
  setState("harnessExplainEventKind", null);
  setState("pkmTargets", []);
  setState("processingIssues", []);
  setState("selectedAutomationArtefactId", null);
  setState("selectedPkmTargetId", null);
  setState("selectedReviewInboxKey", null);
}

export async function loadAutomationCapabilityState(
  loader: AutomationCapabilityLoader,
): Promise<void> {
  await Promise.all([
    loader.loadHarnesses(),
    loader.loadAutomationRules(),
    loader.loadAutomationRuns(),
    loader.loadAutomationArtefacts(),
    loader.loadPkmTargets(),
    loader.loadProcessingIssues(),
  ]);
}

export function pluginExposesAutomationCapability(
  plugin: GranolaAppPluginState | null | undefined,
): boolean {
  return pluginSupportsCapability(plugin, "automation");
}
