import type { SetStoreFunction } from "solid-js/store";

import type { GranolaExportTarget } from "../app/index.ts";
import {
  defaultExportTargetNotesFormat,
  defaultExportTargetNotesSubdir,
  defaultExportTargetTranscriptsFormat,
  defaultExportTargetTranscriptsSubdir,
} from "../export-target-registry.ts";
import type { GranolaServerClient } from "../server/client.ts";

import type { WebStatusTone } from "./components.tsx";
import type { GranolaWebAppState } from "./types.ts";

interface WebSettingsControllerDeps {
  clientAccessor: () => GranolaServerClient | null;
  refreshAll: (forceRefresh?: boolean) => Promise<void>;
  setState: SetStoreFunction<GranolaWebAppState>;
  setStatus: (label: string, tone?: WebStatusTone) => void;
  state: GranolaWebAppState;
}

export function useSettingsController({
  clientAccessor,
  refreshAll,
  setState,
  setStatus,
  state,
}: WebSettingsControllerDeps) {
  const selectedExportTarget = () =>
    state.exportTargets.find((target) => target.id === state.selectedExportTargetId) ?? null;

  const loadKnowledgeBases = async () => {
    const client = clientAccessor();
    if (!client) {
      return;
    }

    const result = await client.listExportTargets();
    setState("exportTargets", result.targets);
    if (
      state.selectedExportTargetId &&
      !result.targets.some((target) => target.id === state.selectedExportTargetId)
    ) {
      setState("selectedExportTargetId", null);
    }
  };

  const currentExportScopeLabel = () =>
    state.selectedFolderId
      ? state.folders.find((folder) => folder.id === state.selectedFolderId)?.name ||
        state.selectedFolderId
      : "All meetings";

  const exportDestinationSummary = () => {
    const target = selectedExportTarget();
    if (target) {
      const notesSubdir = target.notesSubdir || defaultExportTargetNotesSubdir(target.kind);
      const transcriptsSubdir =
        target.transcriptsSubdir || defaultExportTargetTranscriptsSubdir(target.kind);
      return `${target.name ?? target.id} · ${notesSubdir} + ${transcriptsSubdir}`;
    }

    const notesPath = state.appState?.config.notes.output || "Configured notes output";
    const transcriptsPath =
      state.appState?.config.transcripts.output || "Configured transcript output";
    return `${notesPath} + ${transcriptsPath}`;
  };

  const defaultArchiveSummary = () => {
    const notesPath = state.appState?.config.notes.output || "Configured notes output";
    const transcriptsPath =
      state.appState?.config.transcripts.output || "Configured transcript output";
    return `${notesPath} + ${transcriptsPath}`;
  };

  const saveKnowledgeBase = async (target: GranolaExportTarget) => {
    const client = clientAccessor();
    if (!client) {
      return;
    }

    const existing = await client.listExportTargets();
    const nextTargets = [
      target,
      ...existing.targets.filter((candidate) => candidate.id !== target.id),
    ].sort((left, right) => left.id.localeCompare(right.id));
    const result = await client.saveExportTargets(nextTargets);
    setState("exportTargets", result.targets);
    setState("selectedExportTargetId", target.id);
    setStatus(`Saved knowledge base ${target.name ?? target.id}`, "ok");
  };

  const removeKnowledgeBase = async (id: string) => {
    const client = clientAccessor();
    if (!client) {
      return;
    }

    const existing = await client.listExportTargets();
    const nextTargets = existing.targets.filter((candidate) => candidate.id !== id);
    const result = await client.saveExportTargets(nextTargets);
    setState("exportTargets", result.targets);
    if (state.selectedExportTargetId === id) {
      setState("selectedExportTargetId", null);
    }
    setStatus("Removed knowledge base", "ok");
  };

  const runBundledExport = async () => {
    const client = clientAccessor();
    if (!client) {
      return;
    }

    const target = selectedExportTarget();
    const folderId = state.selectedFolderId || undefined;
    const scopeLabel = folderId ? currentExportScopeLabel() : "all meetings";
    setStatus(`Exporting ${scopeLabel}…`, "busy");
    try {
      if (state.exportMode !== "transcripts") {
        await client.exportNotes(
          target ? (target.notesFormat ?? defaultExportTargetNotesFormat(target.kind)) : "markdown",
          {
            folderId,
            scopedOutput: true,
            targetId: target?.id,
          },
        );
      }
      if (state.exportMode !== "notes") {
        await client.exportTranscripts(
          target
            ? (target.transcriptsFormat ?? defaultExportTargetTranscriptsFormat(target.kind))
            : "text",
          {
            folderId,
            scopedOutput: true,
            targetId: target?.id,
          },
        );
      }
      await refreshAll();
      setStatus(target ? `Exported via ${target.name ?? target.id}` : "Export complete", "ok");
    } catch (error) {
      setState("detailError", error instanceof Error ? error.message : String(error));
      setStatus("Export failed", "error");
    }
  };

  const rerunExportJob = async (jobId: string) => {
    const client = clientAccessor();
    if (!client) {
      return;
    }

    setStatus("Rerunning export…", "busy");
    try {
      await client.rerunExportJob(jobId);
      await refreshAll();
    } catch (error) {
      setState("detailError", error instanceof Error ? error.message : String(error));
      setStatus("Rerun failed", "error");
    }
  };

  return {
    currentExportScopeLabel,
    defaultArchiveSummary,
    exportDestinationSummary,
    loadKnowledgeBases,
    removeKnowledgeBase,
    rerunExportJob,
    runBundledExport,
    saveKnowledgeBase,
  };
}
