/** @jsxImportSource solid-js */

import { createSignal, For, onCleanup, Show, type JSX } from "solid-js";

import type { GranolaAppAuthState, GranolaAppPluginState } from "../app/index.ts";
import { pluginStateStatusDetail } from "../app/plugin-state.ts";
import { granolaAuthModeLabel, granolaAuthRecommendation } from "../auth-summary.ts";
import { compactPathLabel } from "./component-helpers.ts";

import { DiagnosticsMetricCard } from "./settings-diagnostics.tsx";
export { DiagnosticsPanel } from "./settings-diagnostics.tsx";
export { KnowledgeBasesPanel } from "./settings-knowledge-bases.tsx";

interface AuthPanelProps {
  apiKeyDraft: string;
  auth?: GranolaAppAuthState;
  onApiKeyDraftChange: (value: string) => void;
  onClearApiKey: () => void;
  onImportDesktopSession: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  onSaveApiKey: () => void;
  onSwitchMode: (mode: GranolaAppAuthState["mode"]) => void;
}

interface PluginsPanelProps {
  onTogglePlugin: (id: string, enabled: boolean) => void;
  plugins: GranolaAppPluginState[];
}

function CopyPathButton(props: { value?: string; variant?: "icon" | "text" }): JSX.Element {
  const [copied, setCopied] = createSignal(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
  });

  const copy = async () => {
    if (!props.value?.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      if (resetTimer) {
        clearTimeout(resetTimer);
      }
      resetTimer = setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      aria-label={copied() ? "Copied" : "Copy path"}
      class={props.variant === "icon" ? "copy-icon-button" : "mini-button"}
      disabled={!props.value?.trim()}
      onClick={() => void copy()}
      title={copied() ? "Copied" : "Copy path"}
      type="button"
    >
      <Show when={props.variant === "icon"} fallback={copied() ? "Copied" : "Copy path"}>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <Show
            when={copied()}
            fallback={
              <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z" />
            }
          >
            <path d="M9.6 16.6 6 13l1.4-1.4 2.2 2.2 6-6L17 9.2l-7.4 7.4Z" />
          </Show>
        </svg>
      </Show>
    </button>
  );
}

export function AuthPanel(props: AuthPanelProps): JSX.Element {
  const activeTone = (auth: GranolaAppAuthState) => {
    if (auth.lastError) {
      return "error";
    }

    return granolaAuthRecommendation(auth).status === "Recommended auth active" ? "ok" : "busy";
  };
  const fallbackSources = () => {
    const available = [
      props.auth?.storedSessionAvailable ? "Desktop session" : null,
      props.auth?.supabaseAvailable ? "supabase.json" : null,
    ].filter(Boolean);

    return available.length > 0 ? available.join(" · ") : "No fallbacks ready yet";
  };
  const authAvailabilityLabel = (available: boolean, readyLabel = "Ready") =>
    available ? readyLabel : "Unavailable";
  const savedApiKeyStatus = () => {
    if (!props.auth?.apiKeyAvailable) {
      return {
        detail:
          "No Personal API key is currently saved. Add one here to make it the default connection path.",
        title: "No saved key",
      };
    }

    if (props.auth.mode === "api-key") {
      return {
        detail: "This saved key is currently the active Granola connection source.",
        title: "Saved and active",
      };
    }

    return {
      detail: "A saved key is ready and can be switched to without re-entering it.",
      title: "Saved",
    };
  };

  return (
    <section class="auth-panel">
      <div class="auth-panel__head">
        <h3>Connection</h3>
        <p>
          Prefer a Granola Personal API key, then keep a desktop session and{" "}
          <code>supabase.json</code> as fallbacks when needed.
        </p>
      </div>
      <div class="auth-panel__body">
        <Show
          fallback={
            <div class="auth-card">
              <div class="auth-card__meta">Auth state unavailable.</div>
            </div>
          }
          when={props.auth}
        >
          {(auth) => (
            <>
              <div class="auth-card auth-card--hero">
                <div class="auth-card__hero">
                  <div>
                    <span class="status-label">Connected with</span>
                    <div class="auth-card__title-row">
                      <strong class="auth-card__title">{granolaAuthModeLabel(auth().mode)}</strong>
                      <span class="state-badge" data-tone={activeTone(auth())}>
                        {granolaAuthRecommendation(auth()).status}
                      </span>
                    </div>
                    <p class="auth-card__lead">{granolaAuthRecommendation(auth()).detail}</p>
                  </div>
                  <Show when={auth().lastError}>
                    <div class="auth-card__meta auth-card__error">{auth().lastError}</div>
                  </Show>
                </div>
                <div class="diagnostic-card-grid diagnostic-card-grid--metrics">
                  <DiagnosticsMetricCard
                    detail={savedApiKeyStatus().detail}
                    label="Personal API key"
                    meta={auth().apiKeyAvailable ? "Stored in toolkit auth state" : undefined}
                    title={savedApiKeyStatus().title}
                  />
                  <DiagnosticsMetricCard
                    detail={fallbackSources()}
                    label="Fallback sources"
                    meta={
                      auth().storedSessionAvailable || auth().supabaseAvailable
                        ? "Available if the API key is missing or rate-limited"
                        : undefined
                    }
                    title={
                      auth().storedSessionAvailable || auth().supabaseAvailable
                        ? "Fallbacks ready"
                        : "No fallbacks ready"
                    }
                  />
                </div>
                <div class="auth-detail-list">
                  <div class="auth-detail-row">
                    <span class="auth-detail-row__label">Desktop session</span>
                    <span class="auth-detail-row__value">
                      {authAvailabilityLabel(auth().storedSessionAvailable)}
                    </span>
                  </div>
                  <div class="auth-detail-row">
                    <span class="auth-detail-row__label">Refresh</span>
                    <span class="auth-detail-row__value">
                      {authAvailabilityLabel(
                        auth().storedSessionAvailable && auth().refreshAvailable,
                      )}
                    </span>
                  </div>
                  <Show when={auth().signInMethod}>
                    <div class="auth-detail-row">
                      <span class="auth-detail-row__label">Sign-in method</span>
                      <span class="auth-detail-row__value">{auth().signInMethod}</span>
                    </div>
                  </Show>
                  <Show when={auth().clientId}>
                    <div class="auth-detail-row">
                      <span class="auth-detail-row__label">Client ID</span>
                      <span class="auth-detail-row__value">{auth().clientId}</span>
                    </div>
                  </Show>
                  <Show when={auth().supabasePath}>
                    <div class="auth-detail-row auth-detail-row--path">
                      <div>
                        <span class="auth-detail-row__label">supabase.json</span>
                        <span class="auth-detail-row__value">
                          {compactPathLabel(auth().supabasePath)}
                        </span>
                      </div>
                      <CopyPathButton value={auth().supabasePath} />
                    </div>
                  </Show>
                </div>
                <Show when={granolaAuthRecommendation(auth()).nextAction}>
                  {(nextAction) => <div class="auth-card__meta">Next step: {nextAction()}</div>}
                </Show>
              </div>

              <div class="auth-card">
                <div class="auth-section-head">
                  <div>
                    <span class="status-label">Saved API key</span>
                    <h4>Manage the saved key</h4>
                  </div>
                  <p>
                    <Show
                      when={auth().apiKeyAvailable}
                      fallback={
                        <>
                          Save a Personal API key here for the default connection path. You can also
                          use <code>gran auth login --api-key &lt;token&gt;</code>.
                        </>
                      }
                    >
                      <>
                        A Personal API key is already saved. Paste a new one to rotate it, switch to
                        it when needed, or remove it without touching desktop-session fallbacks.
                      </>
                    </Show>
                  </p>
                </div>
                <div class="auth-card__meta">
                  <strong>{savedApiKeyStatus().title}.</strong> {savedApiKeyStatus().detail}
                </div>
                <div class="auth-inline">
                  <input
                    class="input"
                    onInput={(event) => {
                      props.onApiKeyDraftChange(event.currentTarget.value);
                    }}
                    placeholder={
                      auth().apiKeyAvailable
                        ? "Paste a new grn_... to replace the saved key"
                        : "grn_..."
                    }
                    type="password"
                    value={props.apiKeyDraft}
                  />
                  <button
                    class="button button--secondary"
                    onClick={props.onSaveApiKey}
                    type="button"
                  >
                    {auth().apiKeyAvailable ? "Save new key" : "Save API key"}
                  </button>
                </div>
                <div class="auth-card__actions">
                  <button
                    class="button button--secondary"
                    disabled={!auth().apiKeyAvailable || auth().mode === "api-key"}
                    onClick={() => {
                      props.onSwitchMode("api-key");
                    }}
                    type="button"
                  >
                    {auth().apiKeyAvailable && auth().mode === "api-key"
                      ? "Using saved key"
                      : "Use saved key"}
                  </button>
                  <button
                    class="button button--secondary"
                    disabled={!auth().apiKeyAvailable}
                    onClick={props.onClearApiKey}
                    type="button"
                  >
                    Remove saved key
                  </button>
                </div>
              </div>

              <div class="auth-card">
                <div class="auth-section-head">
                  <div>
                    <span class="status-label">Fallbacks</span>
                    <h4>Switch or refresh another source</h4>
                  </div>
                  <p>
                    Desktop session import and <code>supabase.json</code> stay available when the
                    default API-key path needs help.
                  </p>
                </div>
                <div class="auth-card__actions">
                  <button
                    class="button button--secondary"
                    disabled={!auth().supabaseAvailable}
                    onClick={props.onImportDesktopSession}
                    type="button"
                  >
                    Import desktop session fallback
                  </button>
                  <button
                    class="button button--secondary"
                    disabled={!auth().storedSessionAvailable || !auth().refreshAvailable}
                    onClick={props.onRefresh}
                    type="button"
                  >
                    Refresh stored session
                  </button>
                  <button
                    class="button button--secondary"
                    disabled={!auth().storedSessionAvailable || auth().mode === "stored-session"}
                    onClick={() => {
                      props.onSwitchMode("stored-session");
                    }}
                    type="button"
                  >
                    Use stored session
                  </button>
                  <button
                    class="button button--secondary"
                    disabled={!auth().supabaseAvailable || auth().mode === "supabase-file"}
                    onClick={() => {
                      props.onSwitchMode("supabase-file");
                    }}
                    type="button"
                  >
                    Use supabase.json
                  </button>
                  <button
                    class="button button--secondary"
                    disabled={!auth().apiKeyAvailable && !auth().storedSessionAvailable}
                    onClick={props.onLogout}
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </Show>
      </div>
    </section>
  );
}

export function PluginsPanel(props: PluginsPanelProps): JSX.Element {
  const renderPluginCard = (input: { detail: string; plugin: GranolaAppPluginState }) => (
    <div class="auth-card">
      <div class="status-grid">
        <div>
          <span class="status-label">Plugin</span>
          <strong>{input.plugin.label}</strong>
        </div>
        <div>
          <span class="status-label">Shipped</span>
          <strong>{input.plugin.shipped ? "yes" : "no"}</strong>
        </div>
        <div>
          <span class="status-label">Status</span>
          <strong>{input.plugin.enabled ? "enabled" : "disabled"}</strong>
        </div>
        <div>
          <span class="status-label">Configurable</span>
          <strong>{input.plugin.configurable ? "yes" : "no"}</strong>
        </div>
      </div>
      <div class="auth-card__meta">{input.plugin.description}</div>
      <div class="auth-card__meta">{input.detail}</div>
      <div class="auth-card__actions">
        <button
          class="button button--secondary"
          onClick={() => {
            props.onTogglePlugin(input.plugin.id, !input.plugin.enabled);
          }}
          type="button"
        >
          {input.plugin.enabled
            ? `Disable ${input.plugin.label.toLowerCase()}`
            : `Enable ${input.plugin.label.toLowerCase()}`}
        </button>
      </div>
    </div>
  );

  return (
    <section class="auth-panel">
      <div class="auth-panel__head">
        <h3>Advanced capabilities</h3>
        <p>
          Turn optional capabilities on only when you need them, then adjust the local runtime tools
          that sit behind Gran.
        </p>
      </div>
      <div class="auth-panel__body">
        <Show
          when={props.plugins.length > 0}
          fallback={<div class="auth-card__meta">No plugins loaded yet.</div>}
        >
          <For each={props.plugins}>
            {(plugin) =>
              renderPluginCard({
                detail: pluginStateStatusDetail(plugin),
                plugin,
              })
            }
          </For>
        </Show>
      </div>
    </section>
  );
}
