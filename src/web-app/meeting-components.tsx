/** @jsxImportSource solid-js */

import { For, Match, Show, Switch, type JSX } from "solid-js";

import type { GranolaMeetingBundle, MeetingRecord } from "../app/index.ts";
import { parseWorkspaceTab, type WorkspaceTab } from "../web/client-state.ts";

import { resolveMeetingWorkspaceState, workspaceBody } from "./component-helpers.ts";
import { MarkdownDocument } from "./markdown-viewer.tsx";

interface WorkspaceProps {
  bundle: GranolaMeetingBundle | null;
  detailError?: string;
  loading?: boolean;
  markdownViewerEnabled: boolean;
  onSelectTab: (tab: WorkspaceTab) => void;
  selectedMeeting: MeetingRecord | null;
  tab: WorkspaceTab;
}

function WorkspaceLoadingState(): JSX.Element {
  return (
    <section aria-live="polite" class="workspace-loading" role="status">
      <span class="loading-block__label">Loading meeting…</span>
      <div class="workspace-tabs">
        <div class="workspace-tab workspace-tab--skeleton" />
        <div class="workspace-tab workspace-tab--skeleton" />
        <div class="workspace-tab workspace-tab--skeleton" />
      </div>
      <section class="workspace-frame">
        <div class="workspace-frame__body workspace-frame__body--loading">
          <div class="loading-line loading-line--short" />
          <div class="loading-line" />
          <div class="loading-line" />
          <div class="loading-line loading-line--medium" />
          <div class="loading-line" />
        </div>
      </section>
    </section>
  );
}

export function Workspace(props: WorkspaceProps): JSX.Element {
  const parsedTab = () => parseWorkspaceTab(props.tab);
  const viewState = () =>
    resolveMeetingWorkspaceState({
      detailError: props.detailError,
      hasMeeting: Boolean(props.selectedMeeting),
      loading: props.loading,
    });
  const details = () => {
    if (!props.selectedMeeting) {
      return null;
    }

    return workspaceBody(props.bundle, props.selectedMeeting, parsedTab());
  };

  return (
    <Switch>
      <Match when={viewState() === "loading"}>
        <WorkspaceLoadingState />
      </Match>
      <Match when={viewState() === "error"}>
        <div class="empty">{props.detailError}</div>
      </Match>
      <Match when={viewState() === "empty"}>
        <div class="empty">Choose a folder, recent meeting, or search result to open it here.</div>
      </Match>
      <Match when={props.selectedMeeting}>
        {(meeting) => (
          <>
            <nav class="workspace-tabs">
              <For each={["notes", "transcript", "metadata", "raw"] as const}>
                {(tab) => (
                  <button
                    class="workspace-tab"
                    data-selected={parsedTab() === tab ? "true" : undefined}
                    onClick={() => {
                      props.onSelectTab(tab);
                    }}
                    type="button"
                  >
                    {tab === "notes"
                      ? "Notes"
                      : tab === "transcript"
                        ? "Transcript"
                        : tab === "metadata"
                          ? "Metadata"
                          : "Raw"}
                  </button>
                )}
              </For>
            </nav>
            <Show when={!props.detailError} fallback={<div class="empty">{props.detailError}</div>}>
              <section class="workspace-frame">
                <Show when={parsedTab() === "metadata" || parsedTab() === "raw"}>
                  <div class="workspace-frame__head">
                    <h2>{details()?.title}</h2>
                    <p>{details()?.description}</p>
                  </div>
                </Show>
                <div class="detail-body workspace-frame__body">
                  <Show
                    when={
                      parsedTab() === "notes" &&
                      props.markdownViewerEnabled &&
                      Boolean(meeting().note.content.trim())
                    }
                    fallback={<pre class="detail-pre">{details()?.body}</pre>}
                  >
                    <MarkdownDocument markdown={meeting().note.content} />
                  </Show>
                </div>
              </section>
            </Show>
          </>
        )}
      </Match>
    </Switch>
  );
}
