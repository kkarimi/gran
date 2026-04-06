/** @jsxImportSource solid-js */

import { For, Show, type JSX } from "solid-js";

import type { GranolaMeetingBundle, MeetingRecord } from "../app/index.ts";
import { parseWorkspaceTab, type WorkspaceTab } from "../web/client-state.ts";

import {
  formatDateLabel,
  formatFolderNames,
  meetingContextSummary,
  noteSourceLabel,
  ownerSummary,
  speakerSummary,
  tagSummary,
  workspaceBody,
} from "./component-helpers.ts";
import { MarkdownDocument } from "./markdown-viewer.tsx";

interface WorkspaceProps {
  bundle: GranolaMeetingBundle | null;
  detailError?: string;
  markdownViewerEnabled: boolean;
  onSelectTab: (tab: WorkspaceTab) => void;
  selectedMeeting: MeetingRecord | null;
  tab: WorkspaceTab;
}

export function Workspace(props: WorkspaceProps): JSX.Element {
  const parsedTab = () => parseWorkspaceTab(props.tab);
  const details = () => {
    if (!props.selectedMeeting) {
      return null;
    }

    return workspaceBody(props.bundle, props.selectedMeeting, parsedTab());
  };

  return (
    <Show
      when={props.selectedMeeting}
      fallback={
        <div class="empty">
          {props.detailError ||
            "Choose a folder, recent meeting, or search result to open it here."}
        </div>
      }
    >
      {(meeting) => (
        <>
          <section class="meeting-context">
            <div class="meeting-context__head">
              <div>
                <p class="meeting-context__eyebrow">Selected meeting</p>
                <h2>{meeting().meeting.title || meeting().meeting.id}</h2>
                <p class="meeting-context__summary">{meetingContextSummary(meeting())}</p>
              </div>
              <div class="meeting-context__stats">
                <div class="meeting-context__stat">
                  <span class="dashboard-stat__label">Notes source</span>
                  <strong>{noteSourceLabel(meeting().meeting.noteContentSource)}</strong>
                  <span>Best available note content for this meeting.</span>
                </div>
                <div class="meeting-context__stat">
                  <span class="dashboard-stat__label">Owner signals</span>
                  <strong>{ownerSummary(meeting())}</strong>
                  <span>Derived from participants and transcript cues.</span>
                </div>
                <div class="meeting-context__stat">
                  <span class="dashboard-stat__label">Speakers</span>
                  <strong>{speakerSummary(meeting())}</strong>
                  <span>Speaker labels currently visible in the local record.</span>
                </div>
              </div>
            </div>
            <div class="detail-meta">
              <div class="detail-chip">{`Updated ${formatDateLabel(meeting().meeting.updatedAt)}`}</div>
              <div class="detail-chip">{`Folders: ${formatFolderNames(meeting().meeting.folders)}`}</div>
              <div class="detail-chip">{`Tags: ${tagSummary(meeting().meeting.tags)}`}</div>
              <div class="detail-chip">
                {meeting().meeting.transcriptLoaded
                  ? `${meeting().meeting.transcriptSegmentCount} transcript segments ready`
                  : "Transcript not loaded yet"}
              </div>
            </div>
          </section>
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
            <span class="workspace-hint">1-4 switch tabs, [ and ] cycle</span>
          </nav>
          <Show when={!props.detailError} fallback={<div class="empty">{props.detailError}</div>}>
            <section class="workspace-frame">
              <div class="workspace-frame__head">
                <h2>{details()?.title}</h2>
                <p>{details()?.description}</p>
              </div>
              <div class="detail-body workspace-frame__body">
                <Show
                  when={parsedTab() === "notes" && props.markdownViewerEnabled}
                  fallback={<pre class="detail-pre">{details()?.body}</pre>}
                >
                  <MarkdownDocument markdown={meeting().noteMarkdown} />
                </Show>
              </div>
            </section>
          </Show>
        </>
      )}
    </Show>
  );
}
