/** @jsxImportSource solid-js */

import { createSignal, For, Show, type JSX } from "solid-js";

import type {
  GranolaAppExportJobState,
  GranolaExportTarget,
  GranolaExportTargetKind,
} from "../app/index.ts";
import {
  defaultExportTargetNotesSubdir,
  defaultExportTargetTranscriptsSubdir,
  resolveGranolaExportTargetDefinition,
} from "../export-target-registry.ts";

import { scopeLabel } from "./component-helpers.ts";
import type { GranolaWebExportMode } from "./types.ts";

interface KnowledgeBasesPanelProps {
  defaultArchiveSummary: string;
  currentScopeLabel: string;
  exportDestinationSummary: string;
  exportMode: GranolaWebExportMode;
  jobs: GranolaAppExportJobState[];
  onExportModeChange: (mode: GranolaWebExportMode) => void;
  onRemoveKnowledgeBase: (id: string) => void;
  onRerun: (id: string) => void;
  onRunExport: () => void;
  onSaveKnowledgeBase: (target: GranolaExportTarget) => void;
  onSelectTarget: (id: string | null) => void;
  selectedTargetId: string | null;
  targets: GranolaExportTarget[];
}

interface KnowledgeBaseDraft {
  dailyNotesDir: string;
  id: string;
  kind: GranolaExportTargetKind;
  name: string;
  notesSubdir: string;
  outputDir: string;
  transcriptsSubdir: string;
}

function slugifyKnowledgeBaseId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "knowledge-base";
}

function createKnowledgeBaseDraft(
  kind: GranolaExportTargetKind,
  target?: GranolaExportTarget,
): KnowledgeBaseDraft {
  return {
    dailyNotesDir: target?.dailyNotesDir ?? "",
    id: target?.id ?? "",
    kind,
    name: target?.name ?? "",
    notesSubdir: target?.notesSubdir ?? defaultExportTargetNotesSubdir(kind),
    outputDir: target?.outputDir ?? "",
    transcriptsSubdir: target?.transcriptsSubdir ?? defaultExportTargetTranscriptsSubdir(kind),
  };
}

function knowledgeBaseKindLabel(kind: GranolaExportTargetKind): string {
  return resolveGranolaExportTargetDefinition(kind).label;
}

function buildKnowledgeBaseDraftTarget(draft: KnowledgeBaseDraft): GranolaExportTarget {
  const name = draft.name.trim();
  const outputDir = draft.outputDir.trim();
  return {
    dailyNotesDir:
      draft.kind === "obsidian-vault" && draft.dailyNotesDir.trim()
        ? draft.dailyNotesDir.trim()
        : undefined,
    id: draft.id.trim() || slugifyKnowledgeBaseId(name || outputDir),
    kind: draft.kind,
    name: name || undefined,
    notesSubdir: draft.notesSubdir.trim() || defaultExportTargetNotesSubdir(draft.kind),
    outputDir,
    transcriptsSubdir:
      draft.transcriptsSubdir.trim() || defaultExportTargetTranscriptsSubdir(draft.kind),
  };
}

export function KnowledgeBasesPanel(props: KnowledgeBasesPanelProps): JSX.Element {
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [draftError, setDraftError] = createSignal("");
  const [draft, setDraft] = createSignal<KnowledgeBaseDraft>(
    createKnowledgeBaseDraft("obsidian-vault"),
  );
  const selectedKnowledgeBase = () =>
    props.targets.find((candidate) => candidate.id === props.selectedTargetId) ?? null;

  const resetDraft = (kind: GranolaExportTargetKind = "obsidian-vault") => {
    setEditingId(null);
    setDraftError("");
    setDraft(createKnowledgeBaseDraft(kind));
  };

  const editKnowledgeBase = (target: GranolaExportTarget) => {
    setEditingId(target.id);
    setDraftError("");
    setDraft(createKnowledgeBaseDraft(target.kind, target));
  };

  const saveKnowledgeBase = async () => {
    const nextDraft = draft();
    if (!nextDraft.outputDir.trim()) {
      setDraftError("Choose a folder or vault path first.");
      return;
    }

    setDraftError("");
    props.onSaveKnowledgeBase(buildKnowledgeBaseDraftTarget(nextDraft));
    resetDraft(nextDraft.kind);
  };

  return (
    <>
      <section class="auth-panel">
        <div class="auth-panel__head">
          <h3>Knowledge bases</h3>
          <p>
            Choose where Gran should publish notes and transcripts. Obsidian vaults are first class,
            and plain folders still work when you just want files you own.
          </p>
        </div>
        <div class="auth-panel__body">
          <div class="auth-card-grid auth-card-grid--three">
            <article class="auth-card">
              <span class="status-label">Current destination</span>
              <strong>{selectedKnowledgeBase()?.name ?? "Default local archive"}</strong>
              <span class="auth-card__meta">{props.exportDestinationSummary}</span>
            </article>
            <article class="auth-card">
              <span class="status-label">Default local archive</span>
              <strong>Folder-based export</strong>
              <span class="auth-card__meta">{props.defaultArchiveSummary}</span>
            </article>
            <article class="auth-card">
              <span class="status-label">Current scope</span>
              <strong>{props.currentScopeLabel}</strong>
              <span class="auth-card__meta">
                Bundled export keeps the current folder scope when one is selected.
              </span>
            </article>
          </div>
          <section class="knowledge-base-shell">
            <div class="knowledge-base-list">
              <button
                class="job-card job-card--button"
                data-selected={!props.selectedTargetId ? "true" : undefined}
                onClick={() => props.onSelectTarget(null)}
                type="button"
              >
                <div class="job-card__head">
                  <div>
                    <div class="job-card__title">Default local archive</div>
                    <div class="job-card__meta">{props.defaultArchiveSummary}</div>
                  </div>
                  <div
                    class="job-card__status"
                    data-status={!props.selectedTargetId ? "approved" : "completed"}
                  >
                    {!props.selectedTargetId ? "Active" : "Available"}
                  </div>
                </div>
                <div class="job-card__meta">{props.exportDestinationSummary}</div>
              </button>
              <Show
                when={props.targets.length > 0}
                fallback={<div class="job-empty">No knowledge bases saved yet.</div>}
              >
                <For each={props.targets}>
                  {(target) => (
                    <article class="job-card">
                      <div class="job-card__head">
                        <div>
                          <div class="job-card__title">{target.name ?? target.id}</div>
                          <div class="job-card__meta">
                            {knowledgeBaseKindLabel(target.kind)} · {target.outputDir}
                          </div>
                        </div>
                        <div
                          class="job-card__status"
                          data-status={
                            props.selectedTargetId === target.id ? "approved" : "completed"
                          }
                        >
                          {props.selectedTargetId === target.id ? "Active" : "Saved"}
                        </div>
                      </div>
                      <div class="job-card__meta">
                        Notes: {target.notesSubdir || defaultExportTargetNotesSubdir(target.kind)} ·
                        Transcripts:{" "}
                        {target.transcriptsSubdir ||
                          defaultExportTargetTranscriptsSubdir(target.kind)}
                      </div>
                      <Show when={target.kind === "obsidian-vault" && target.dailyNotesDir}>
                        {(dailyNotesDir) => (
                          <div class="job-card__meta">Daily notes: {dailyNotesDir()}</div>
                        )}
                      </Show>
                      <div class="job-card__actions">
                        <Show when={props.selectedTargetId !== target.id}>
                          <button
                            class="button button--secondary"
                            onClick={() => props.onSelectTarget(target.id)}
                            type="button"
                          >
                            Use for exports
                          </button>
                        </Show>
                        <button
                          class="button button--secondary"
                          onClick={() => editKnowledgeBase(target)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          class="button button--secondary"
                          onClick={() => props.onRemoveKnowledgeBase(target.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  )}
                </For>
              </Show>
            </div>
            <section class="auth-card auth-card--hero knowledge-base-editor">
              <div class="auth-section-head">
                <h4>{editingId() ? "Edit knowledge base" : "Add knowledge base"}</h4>
                <p>
                  Start with an Obsidian vault, or point Gran at a plain folder when you just want a
                  durable local archive.
                </p>
              </div>
              <div class="toolbar-actions">
                <button
                  class="button button--secondary"
                  onClick={() => resetDraft("obsidian-vault")}
                  type="button"
                >
                  New Obsidian vault
                </button>
                <button
                  class="button button--secondary"
                  onClick={() => resetDraft("bundle-folder")}
                  type="button"
                >
                  New folder
                </button>
              </div>
              <div class="field-row">
                <label>
                  <span class="field-label">Type</span>
                  <select
                    class="select"
                    onChange={(event) => {
                      const kind = event.currentTarget.value as GranolaExportTargetKind;
                      setDraft((current) => ({
                        ...createKnowledgeBaseDraft(kind, {
                          ...buildKnowledgeBaseDraftTarget(current),
                          kind,
                        }),
                        id: current.id,
                        name: current.name,
                        outputDir: current.outputDir,
                      }));
                    }}
                    value={draft().kind}
                  >
                    <option value="obsidian-vault">Obsidian vault</option>
                    <option value="bundle-folder">Folder</option>
                  </select>
                </label>
                <label>
                  <span class="field-label">Name</span>
                  <input
                    class="field-input"
                    onInput={(event) => {
                      setDraft((current) => ({ ...current, name: event.currentTarget.value }));
                    }}
                    placeholder={draft().kind === "obsidian-vault" ? "Work vault" : "Team archive"}
                    type="text"
                    value={draft().name}
                  />
                </label>
              </div>
              <label>
                <span class="field-label">
                  {draft().kind === "obsidian-vault" ? "Vault path" : "Folder path"}
                </span>
                <input
                  class="field-input"
                  onInput={(event) => {
                    setDraft((current) => ({ ...current, outputDir: event.currentTarget.value }));
                  }}
                  placeholder={
                    draft().kind === "obsidian-vault"
                      ? "~/Vaults/Work"
                      : "~/Documents/Meeting Archive"
                  }
                  spellcheck={false}
                  type="text"
                  value={draft().outputDir}
                />
              </label>
              <div class="field-row">
                <label>
                  <span class="field-label">Notes folder</span>
                  <input
                    class="field-input"
                    onInput={(event) => {
                      setDraft((current) => ({
                        ...current,
                        notesSubdir: event.currentTarget.value,
                      }));
                    }}
                    spellcheck={false}
                    type="text"
                    value={draft().notesSubdir}
                  />
                </label>
                <label>
                  <span class="field-label">Transcripts folder</span>
                  <input
                    class="field-input"
                    onInput={(event) => {
                      setDraft((current) => ({
                        ...current,
                        transcriptsSubdir: event.currentTarget.value,
                      }));
                    }}
                    spellcheck={false}
                    type="text"
                    value={draft().transcriptsSubdir}
                  />
                </label>
              </div>
              <Show when={draft().kind === "obsidian-vault"}>
                <label>
                  <span class="field-label">Daily notes folder</span>
                  <input
                    class="field-input"
                    onInput={(event) => {
                      setDraft((current) => ({
                        ...current,
                        dailyNotesDir: event.currentTarget.value,
                      }));
                    }}
                    placeholder="Daily"
                    spellcheck={false}
                    type="text"
                    value={draft().dailyNotesDir}
                  />
                </label>
              </Show>
              <Show when={draftError()}>
                {(error) => <div class="auth-card__meta auth-card__meta--error">{error()}</div>}
              </Show>
              <div class="toolbar-actions">
                <button
                  class="button button--primary"
                  onClick={() => void saveKnowledgeBase()}
                  type="button"
                >
                  {editingId() ? "Save knowledge base" : "Add knowledge base"}
                </button>
                <button
                  class="button button--secondary"
                  onClick={() => resetDraft(draft().kind)}
                  type="button"
                >
                  Clear
                </button>
              </div>
            </section>
          </section>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-panel__head">
          <h3>Export now</h3>
          <p>Run a bundled export into the current local archive or selected knowledge base.</p>
        </div>
        <div class="auth-panel__body">
          <div class="field-row field-row--inline">
            <label>
              <span class="field-label">Destination</span>
              <select
                class="select"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  props.onSelectTarget(value ? value : null);
                }}
                value={props.selectedTargetId ?? ""}
              >
                <option value="">Default local archive</option>
                <For each={props.targets}>
                  {(target) => <option value={target.id}>{target.name ?? target.id}</option>}
                </For>
              </select>
            </label>
            <label>
              <span class="field-label">Contents</span>
              <select
                class="select"
                onChange={(event) => {
                  props.onExportModeChange(event.currentTarget.value as GranolaWebExportMode);
                }}
                value={props.exportMode}
              >
                <option value="both">Notes + transcripts</option>
                <option value="notes">Notes only</option>
                <option value="transcripts">Transcripts only</option>
              </select>
            </label>
          </div>
          <div class="toolbar-actions">
            <button
              class="button button--primary"
              onClick={() => props.onRunExport()}
              type="button"
            >
              Export archive
            </button>
          </div>
        </div>
      </section>
      <section class="jobs-panel">
        <div class="jobs-panel__head">
          <h3>Recent export jobs</h3>
          <p>Tracked across CLI and web runs.</p>
        </div>
        <div class="jobs-list">
          <Show
            when={props.jobs.length > 0}
            fallback={<div class="job-empty">No export jobs yet.</div>}
          >
            <For each={props.jobs.slice(0, 6)}>
              {(job) => (
                <article class="job-card">
                  <div class="job-card__head">
                    <div>
                      <div class="job-card__title">{job.kind} export</div>
                      <div class="job-card__meta">{job.id}</div>
                    </div>
                    <div class="job-card__status" data-status={job.status}>
                      {job.status}
                    </div>
                  </div>
                  <div class="job-card__meta">
                    {`Format: ${job.format} • ${scopeLabel(job.scope)} • ${
                      job.itemCount > 0 ? `${job.completedCount}/${job.itemCount} items` : "0 items"
                    } • Written: ${job.written}`}
                  </div>
                  <div class="job-card__meta">Started: {job.startedAt.slice(0, 19)}</div>
                  <div class="job-card__meta">Output: {job.outputDir}</div>
                  <Show when={job.error}>
                    <div class="job-card__meta">{job.error}</div>
                  </Show>
                  <div class="job-card__actions">
                    <Show when={job.status !== "running"}>
                      <button
                        class="button button--secondary"
                        onClick={() => {
                          props.onRerun(job.id);
                        }}
                        type="button"
                      >
                        Rerun
                      </button>
                    </Show>
                  </div>
                </article>
              )}
            </For>
          </Show>
        </div>
      </section>
    </>
  );
}
