/** @jsxImportSource solid-js */

import { For, Show, type JSX } from "solid-js";

import type {
  GranolaAgentHarness,
  GranolaAgentHarnessMatchExplanation,
  GranolaAutomationArtefactKind,
  GranolaAutomationEvaluationRun,
  GranolaSyncEventKind,
  MeetingRecord,
} from "../app/index.ts";

interface HarnessEditorPanelProps {
  dirty: boolean;
  error?: string;
  explanations: GranolaAgentHarnessMatchExplanation[];
  explanationEventKind?: GranolaSyncEventKind | null;
  harnesses: GranolaAgentHarness[];
  onChange: (harness: GranolaAgentHarness) => void;
  onDuplicate: () => void;
  onNew: () => void;
  onReload: () => void;
  onRemove: () => void;
  onSave: () => void;
  onSelect: (id: string) => void;
  onTest: () => void;
  onTestKindChange: (kind: GranolaAutomationArtefactKind) => void;
  selectedHarness: GranolaAgentHarness | null;
  selectedHarnessId?: string | null;
  selectedMeeting: MeetingRecord | null;
  testKind: GranolaAutomationArtefactKind;
  testResult: GranolaAutomationEvaluationRun | null;
}

function csvValues(values?: string[]): string {
  return values?.join(", ") ?? "";
}

function parseCsvValues(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? [...new Set(items)] : undefined;
}

function compactMatch(
  match: GranolaAgentHarness["match"] | undefined,
): GranolaAgentHarness["match"] | undefined {
  if (!match) {
    return undefined;
  }

  const next: GranolaAgentHarness["match"] = {
    calendarEventIds: match.calendarEventIds,
    eventKinds: match.eventKinds,
    folderIds: match.folderIds,
    folderNames: match.folderNames,
    meetingIds: match.meetingIds,
    recurringEventIds: match.recurringEventIds,
    tags: match.tags,
    titleIncludes: match.titleIncludes,
    titleMatches: match.titleMatches?.trim() || undefined,
    transcriptLoaded: match.transcriptLoaded,
  };

  return Object.values(next).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "",
  )
    ? next
    : undefined;
}

function sanitiseHarnessSeed(value: string): string {
  const seed = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return seed || "new-harness";
}

function nextUniqueHarnessId(existing: GranolaAgentHarness[], seed: string): string {
  const base = sanitiseHarnessSeed(seed);
  const ids = new Set(existing.map((harness) => harness.id));
  if (!ids.has(base)) {
    return base;
  }

  let index = 2;
  while (ids.has(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

export function createHarnessTemplate(existing: GranolaAgentHarness[]): GranolaAgentHarness {
  return {
    id: nextUniqueHarnessId(existing, "new harness"),
    name: "New Harness",
    prompt: "Describe the structure and output you want for this meeting type.",
    provider: "codex",
  };
}

export function duplicateHarnessTemplate(
  existing: GranolaAgentHarness[],
  harness: GranolaAgentHarness,
): GranolaAgentHarness {
  return {
    ...structuredClone(harness),
    id: nextUniqueHarnessId(existing, `${harness.id} copy`),
    name: `${harness.name} Copy`,
  };
}

function patchHarness(
  harness: GranolaAgentHarness,
  patch: Partial<GranolaAgentHarness>,
): GranolaAgentHarness {
  return {
    ...harness,
    ...patch,
    match: compactMatch(patch.match ?? harness.match),
  };
}

function patchHarnessMatch(
  harness: GranolaAgentHarness,
  patch: Partial<NonNullable<GranolaAgentHarness["match"]>>,
): GranolaAgentHarness {
  return patchHarness(harness, {
    match: {
      ...harness.match,
      ...patch,
    },
  });
}

export function HarnessEditorPanel(props: HarnessEditorPanelProps): JSX.Element {
  const selectedExplanation = () =>
    props.explanations.find((explanation) => explanation.harness.id === props.selectedHarnessId) ??
    null;
  const selectedResult = () => props.testResult;
  const selectedHarness = () => props.selectedHarness;

  const updateHarness = (patch: Partial<GranolaAgentHarness>) => {
    const harness = selectedHarness();
    if (!harness) {
      return;
    }

    props.onChange(patchHarness(harness, patch));
  };

  const updateMatch = (patch: Partial<NonNullable<GranolaAgentHarness["match"]>>) => {
    const harness = selectedHarness();
    if (!harness) {
      return;
    }

    props.onChange(patchHarnessMatch(harness, patch));
  };

  return (
    <section class="harness-panel">
      <div class="jobs-panel__head">
        <h3>Harness Editor</h3>
        <p>
          Manage meeting playbooks, inspect why they match the selected meeting, and run the
          selected harness through the current pipeline before changing live automation.
        </p>
      </div>

      <div class="harness-grid">
        <div class="detail-section">
          <div class="harness-toolbar">
            <button class="button button--primary" onClick={props.onNew} type="button">
              New Harness
            </button>
            <button
              class="button button--secondary"
              disabled={!selectedHarness()}
              onClick={props.onDuplicate}
              type="button"
            >
              Duplicate
            </button>
            <button
              class="button button--secondary"
              disabled={!selectedHarness()}
              onClick={props.onRemove}
              type="button"
            >
              Remove
            </button>
            <button class="button button--secondary" onClick={props.onReload} type="button">
              Reload
            </button>
            <button
              class="button button--primary"
              disabled={!props.dirty}
              onClick={props.onSave}
              type="button"
            >
              Save Harnesses
            </button>
          </div>

          <div class="jobs-list">
            <For each={props.harnesses}>
              {(harness) => {
                const explanation = () =>
                  props.explanations.find((candidate) => candidate.harness.id === harness.id) ??
                  null;
                return (
                  <button
                    class="job-card job-card--button"
                    data-selected={props.selectedHarnessId === harness.id}
                    onClick={() => {
                      props.onSelect(harness.id);
                    }}
                    type="button"
                  >
                    <div class="job-card__head">
                      <span class="job-card__title">{harness.name}</span>
                      <span
                        class="job-card__status"
                        data-status={explanation()?.matched ? "completed" : "warning"}
                      >
                        {explanation()?.matched ? "Matched" : "Check"}
                      </span>
                    </div>
                    <div class="job-card__meta">
                      {harness.id}
                      {harness.provider ? ` • ${harness.provider}` : ""}
                      {harness.model ? `/${harness.model}` : ""}
                    </div>
                  </button>
                );
              }}
            </For>
            <Show when={props.harnesses.length === 0}>
              <div class="empty">
                No harnesses configured yet. Create one here and save it to the shared harness file.
              </div>
            </Show>
          </div>
        </div>

        <Show
          when={selectedHarness()}
          fallback={
            <div class="detail-section">
              <div class="empty">Select a harness to edit its prompts, rules, and test output.</div>
            </div>
          }
        >
          {(harness) => (
            <div class="detail-section">
              <div class="harness-status-row">
                <h2>{harness().name}</h2>
                <span class="state-badge" data-tone={props.dirty ? "busy" : "ok"}>
                  {props.dirty ? "Unsaved changes" : "Saved"}
                </span>
              </div>

              <div class="field-row field-row--inline">
                <label>
                  <span class="field-label">Id</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateHarness({ id: event.currentTarget.value.trim() });
                    }}
                    value={harness().id}
                  />
                </label>
                <label>
                  <span class="field-label">Name</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateHarness({ name: event.currentTarget.value });
                    }}
                    value={harness().name}
                  />
                </label>
              </div>

              <div class="field-row field-row--inline">
                <label>
                  <span class="field-label">Provider</span>
                  <select
                    class="select"
                    onChange={(event) => {
                      updateHarness({
                        provider:
                          event.currentTarget.value === ""
                            ? undefined
                            : (event.currentTarget.value as GranolaAgentHarness["provider"]),
                      });
                    }}
                    value={harness().provider ?? ""}
                  >
                    <option value="">Use default</option>
                    <option value="codex">Codex</option>
                    <option value="openai">OpenAI</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                </label>
                <label>
                  <span class="field-label">Model</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateHarness({ model: event.currentTarget.value.trim() || undefined });
                    }}
                    placeholder="gpt-5-codex or openai/gpt-5-mini"
                    value={harness().model ?? ""}
                  />
                </label>
              </div>

              <div class="field-row field-row--inline">
                <label>
                  <span class="field-label">Priority</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      const value = event.currentTarget.value.trim();
                      updateHarness({
                        priority: value ? Number(value) : undefined,
                      });
                    }}
                    placeholder="0"
                    value={harness().priority?.toString() ?? ""}
                  />
                </label>
                <label>
                  <span class="field-label">Working Directory</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateHarness({ cwd: event.currentTarget.value.trim() || undefined });
                    }}
                    placeholder="/path/to/project"
                    value={harness().cwd ?? ""}
                  />
                </label>
              </div>

              <div class="field-row">
                <label>
                  <span class="field-label">Prompt</span>
                  <textarea
                    class="review-textarea review-textarea--summary"
                    onInput={(event) => {
                      updateHarness({ prompt: event.currentTarget.value.trim() || undefined });
                    }}
                    value={harness().prompt ?? ""}
                  />
                </label>
                <label>
                  <span class="field-label">Prompt File</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateHarness({ promptFile: event.currentTarget.value.trim() || undefined });
                    }}
                    placeholder="./agents/customer-call/AGENT.md"
                    value={harness().promptFile ?? ""}
                  />
                </label>
              </div>

              <div class="field-row">
                <label>
                  <span class="field-label">System Prompt</span>
                  <textarea
                    class="review-textarea review-textarea--summary"
                    onInput={(event) => {
                      updateHarness({
                        systemPrompt: event.currentTarget.value.trim() || undefined,
                      });
                    }}
                    value={harness().systemPrompt ?? ""}
                  />
                </label>
                <label>
                  <span class="field-label">System Prompt File</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateHarness({
                        systemPromptFile: event.currentTarget.value.trim() || undefined,
                      });
                    }}
                    placeholder="./agents/customer-call/SYSTEM.md"
                    value={harness().systemPromptFile ?? ""}
                  />
                </label>
              </div>

              <div class="field-row">
                <label>
                  <span class="field-label">Fallback Harnesses</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateHarness({
                        fallbackHarnessIds: parseCsvValues(event.currentTarget.value),
                      });
                    }}
                    placeholder="fallback-a, fallback-b"
                    value={csvValues(harness().fallbackHarnessIds)}
                  />
                </label>
              </div>

              <div class="field-row">
                <label>
                  <span class="field-label">Event Kinds</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateMatch({
                        eventKinds: parseCsvValues(event.currentTarget.value) as NonNullable<
                          GranolaAgentHarness["match"]
                        >["eventKinds"],
                      });
                    }}
                    placeholder="transcript.ready, meeting.created"
                    value={csvValues(harness().match?.eventKinds)}
                  />
                </label>
                <label>
                  <span class="field-label">Meeting Ids</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateMatch({ meetingIds: parseCsvValues(event.currentTarget.value) });
                    }}
                    placeholder="doc-alpha-1111"
                    value={csvValues(harness().match?.meetingIds)}
                  />
                </label>
              </div>

              <div class="field-row field-row--inline">
                <label>
                  <span class="field-label">Folder Ids</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateMatch({ folderIds: parseCsvValues(event.currentTarget.value) });
                    }}
                    placeholder="folder-team-1111"
                    value={csvValues(harness().match?.folderIds)}
                  />
                </label>
                <label>
                  <span class="field-label">Folder Names</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateMatch({ folderNames: parseCsvValues(event.currentTarget.value) });
                    }}
                    placeholder="Team, Customers"
                    value={csvValues(harness().match?.folderNames)}
                  />
                </label>
              </div>

              <div class="field-row field-row--inline">
                <label>
                  <span class="field-label">Tags</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateMatch({ tags: parseCsvValues(event.currentTarget.value) });
                    }}
                    placeholder="customer, weekly"
                    value={csvValues(harness().match?.tags)}
                  />
                </label>
                <label>
                  <span class="field-label">Title Includes</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateMatch({ titleIncludes: parseCsvValues(event.currentTarget.value) });
                    }}
                    placeholder="sync, review"
                    value={csvValues(harness().match?.titleIncludes)}
                  />
                </label>
              </div>

              <div class="field-row field-row--inline">
                <label>
                  <span class="field-label">Title Regex</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateMatch({ titleMatches: event.currentTarget.value.trim() || undefined });
                    }}
                    placeholder="customer.*sync"
                    value={harness().match?.titleMatches ?? ""}
                  />
                </label>
                <label>
                  <span class="field-label">Transcript Loaded</span>
                  <select
                    class="select"
                    onChange={(event) => {
                      updateMatch({
                        transcriptLoaded:
                          event.currentTarget.value === ""
                            ? undefined
                            : event.currentTarget.value === "true",
                      });
                    }}
                    value={
                      harness().match?.transcriptLoaded === undefined
                        ? ""
                        : String(harness().match?.transcriptLoaded)
                    }
                  >
                    <option value="">Either</option>
                    <option value="true">Must be loaded</option>
                    <option value="false">Must be missing</option>
                  </select>
                </label>
              </div>

              <div class="field-row field-row--inline">
                <label>
                  <span class="field-label">Calendar Event Ids</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateMatch({ calendarEventIds: parseCsvValues(event.currentTarget.value) });
                    }}
                    placeholder="event-123"
                    value={csvValues(harness().match?.calendarEventIds)}
                  />
                </label>
                <label>
                  <span class="field-label">Recurring Event Ids</span>
                  <input
                    class="field-input field-input--plain"
                    onInput={(event) => {
                      updateMatch({
                        recurringEventIds: parseCsvValues(event.currentTarget.value),
                      });
                    }}
                    placeholder="recurring-456"
                    value={csvValues(harness().match?.recurringEventIds)}
                  />
                </label>
              </div>

              <div class="detail-section">
                <h3>Selected Meeting Test</h3>
                <div class="job-card__meta">
                  {props.selectedMeeting
                    ? `Run ${harness().name} against ${props.selectedMeeting.meeting.title || props.selectedMeeting.meeting.id}.`
                    : "Select a meeting to explain and test this harness."}
                </div>
                <div class="field-row field-row--inline">
                  <label>
                    <span class="field-label">Pipeline Kind</span>
                    <select
                      class="select"
                      onChange={(event) => {
                        props.onTestKindChange(
                          event.currentTarget.value as GranolaAutomationArtefactKind,
                        );
                      }}
                      value={props.testKind}
                    >
                      <option value="notes">Notes</option>
                      <option value="enrichment">Enrichment</option>
                    </select>
                  </label>
                  <label>
                    <span class="field-label">Rule Explainer Event</span>
                    <input
                      class="field-input field-input--plain"
                      disabled
                      value={props.explanationEventKind ?? "Select a meeting"}
                    />
                  </label>
                </div>
                <div class="harness-toolbar">
                  <button
                    class="button button--primary"
                    disabled={!props.selectedMeeting}
                    onClick={props.onTest}
                    type="button"
                  >
                    Test Harness
                  </button>
                </div>
                <Show when={selectedExplanation()}>
                  {(explanation) => (
                    <>
                      <div
                        class="job-card__status"
                        data-status={explanation().matched ? "completed" : "warning"}
                      >
                        {explanation().matched
                          ? "Matched selected meeting"
                          : "Did not match selected meeting"}
                      </div>
                      <ul class="detail-list">
                        <For each={explanation().reasons}>{(reason) => <li>{reason}</li>}</For>
                      </ul>
                    </>
                  )}
                </Show>
                <Show when={selectedResult()}>
                  {(result) => (
                    <div class="harness-test-result">
                      <h3>Latest Test Run</h3>
                      <div class="job-card__meta">
                        {result().status}
                        {result().provider ? ` • ${result().provider}` : ""}
                        {result().model ? `/${result().model}` : ""}
                        {result().parseMode ? ` • ${result().parseMode}` : ""}
                      </div>
                      <Show when={result().status === "failed"}>
                        <div class="auth-card__error">{result().error}</div>
                      </Show>
                      <Show when={result().status === "completed"}>
                        <>
                          <div class="field-row">
                            <label>
                              <span class="field-label">Resolved Prompt Preview</span>
                              <textarea class="review-textarea" readOnly value={result().prompt} />
                            </label>
                            <label>
                              <span class="field-label">Raw Output</span>
                              <textarea
                                class="review-textarea review-textarea--summary"
                                readOnly
                                value={result().rawOutput ?? ""}
                              />
                            </label>
                          </div>
                          <Show when={result().structured}>
                            {(structured) => (
                              <div class="field-row">
                                <label>
                                  <span class="field-label">Structured Title</span>
                                  <input
                                    class="field-input field-input--plain"
                                    disabled
                                    value={structured().title}
                                  />
                                </label>
                                <label>
                                  <span class="field-label">Structured Summary</span>
                                  <textarea
                                    class="review-textarea review-textarea--summary"
                                    readOnly
                                    value={structured().summary ?? ""}
                                  />
                                </label>
                              </div>
                            )}
                          </Show>
                        </>
                      </Show>
                    </div>
                  )}
                </Show>
              </div>

              <Show when={props.error}>
                <div class="auth-card__error">{props.error}</div>
              </Show>
            </div>
          )}
        </Show>
      </div>
    </section>
  );
}
