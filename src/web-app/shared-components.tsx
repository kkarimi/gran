/** @jsxImportSource solid-js */

import { Show, type JSX } from "solid-js";

import type { GranolaAppState } from "../app/index.ts";
import type { GranolaReviewInboxSummary } from "../review-inbox.ts";
import type { GranolaServerInfo } from "../transport.ts";
import { describeAuthStatus, describeSyncStatus } from "../web/client-state.ts";

import {
  buildIdentityLabel,
  buildStartedAtLabel,
  reviewSummaryLabel,
  runtimeLabel,
} from "./component-helpers.ts";

export type WebStatusTone = "busy" | "error" | "idle" | "ok";
export type WebMainPage = "folders" | "home" | "meeting" | "review" | "search" | "settings";
export type WebSettingsSection = "auth" | "diagnostics" | "exports" | "pipelines";

type WebNavigationPage = Exclude<WebMainPage, "meeting">;

interface PrimaryNavProps {
  activePage: WebMainPage;
  folderCount: number;
  onNavigate: (page: WebNavigationPage) => void;
  onSync: () => void;
  reviewSummary: GranolaReviewInboxSummary;
  serverInfo?: GranolaServerInfo | null;
  statusLabel: string;
  statusTone: WebStatusTone;
}

interface PageHeaderProps {
  actions?: JSX.Element;
  description: string;
  eyebrow?: string;
  title: string;
}

interface SecurityPanelProps {
  onLock: () => void;
  onPasswordChange: (value: string) => void;
  onUnlock: () => void;
  password: string;
  visible: boolean;
}

export function PrimaryNav(props: PrimaryNavProps): JSX.Element {
  const navItems: Array<{ id: WebNavigationPage; label: string; note: string }> = [
    { id: "home", label: "Home", note: "Overview and next steps" },
    { id: "folders", label: "Folders", note: "Browse meetings from folders" },
    { id: "search", label: "Search", note: "Find one meeting on purpose" },
    { id: "review", label: "Review", note: "Handle approvals and issues" },
    { id: "settings", label: "Settings", note: "Auth, automation, exports, diagnostics" },
  ];

  return (
    <aside class="pane primary-nav">
      <div class="primary-nav__hero">
        <p class="primary-nav__eyebrow">Granola Toolkit</p>
        <h1>Local meeting workspace</h1>
        <p>
          Browse by folder, review what needs attention, and open one meeting at a time when you
          actually need it.
        </p>
      </div>
      <button class="button button--primary" onClick={props.onSync} type="button">
        Sync now
      </button>
      <nav class="primary-nav__links" aria-label="Primary">
        {navItems.map((item) => (
          <button
            class="primary-nav__link"
            data-selected={props.activePage === item.id ? "true" : undefined}
            onClick={() => {
              props.onNavigate(item.id);
            }}
            type="button"
          >
            <span class="primary-nav__link-title">{item.label}</span>
            <span class="primary-nav__link-note">{item.note}</span>
          </button>
        ))}
      </nav>
      <section class="primary-nav__status">
        <div class="state-badge" data-tone={props.statusTone}>
          {props.statusLabel}
        </div>
        <div class="primary-nav__stat">
          <span class="status-label">Folders</span>
          <strong>{String(props.folderCount)}</strong>
        </div>
        <div class="primary-nav__stat">
          <span class="status-label">Needs review</span>
          <strong>{reviewSummaryLabel(props.reviewSummary)}</strong>
        </div>
        <div class="primary-nav__stat">
          <span class="status-label">Attached build</span>
          <strong>{buildIdentityLabel(props.serverInfo)}</strong>
          <span class="primary-nav__meta">Started {buildStartedAtLabel(props.serverInfo)}</span>
        </div>
      </section>
    </aside>
  );
}

export function PageHeader(props: PageHeaderProps): JSX.Element {
  return (
    <section class="page-header">
      <div>
        <Show when={props.eyebrow}>
          {(eyebrow) => <p class="page-header__eyebrow">{eyebrow()}</p>}
        </Show>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </div>
      <Show when={props.actions}>
        <div class="page-header__actions">{props.actions}</div>
      </Show>
    </section>
  );
}

export function AppStatePanel(props: {
  appState?: GranolaAppState | null;
  heading: string;
  reviewSummary: GranolaReviewInboxSummary;
  serverInfo?: GranolaServerInfo | null;
  statusLabel: string;
  statusTone: WebStatusTone;
}): JSX.Element {
  const syncStatus = () => describeSyncStatus(props.appState?.sync ?? {});
  const authStatus = () => describeAuthStatus(props.appState?.auth);
  const indexedMeetings = () =>
    props.appState?.index.loaded
      ? props.appState.index.meetingCount
      : props.appState?.documents.loaded
        ? props.appState.documents.count
        : 0;

  return (
    <section class="detail-head">
      <div>
        <h2>{props.heading}</h2>
        <p class="detail-head__copy">
          The browser is attached to your local Granola service, so sync, review, and exports stay
          in step with the CLI and TUI.
        </p>
        <Show fallback={<p>Waiting for server state…</p>} when={props.appState}>
          {(appState) => (
            <div class="status-grid">
              <div>
                <span class="status-label">Connection</span>
                <strong>{authStatus()}</strong>
              </div>
              <div>
                <span class="status-label">Sync</span>
                <strong>{syncStatus()}</strong>
              </div>
              <div>
                <span class="status-label">Meetings indexed</span>
                <strong>{String(indexedMeetings())}</strong>
              </div>
              <div>
                <span class="status-label">Folders</span>
                <strong>
                  {appState().folders.loaded ? String(appState().folders.count) : "Not loaded yet"}
                </strong>
              </div>
              <div>
                <span class="status-label">Needs review</span>
                <strong>{reviewSummaryLabel(props.reviewSummary)}</strong>
              </div>
              <div>
                <span class="status-label">Runtime</span>
                <strong>{runtimeLabel(props.serverInfo)}</strong>
              </div>
            </div>
          )}
        </Show>
        <Show when={props.appState?.auth.lastError}>
          <p>{props.appState?.auth.lastError}</p>
        </Show>
      </div>
      <div class="state-badge" data-tone={props.statusTone}>
        {props.statusLabel}
      </div>
    </section>
  );
}

export function SecurityPanel(props: SecurityPanelProps): JSX.Element {
  return (
    <Show when={props.visible}>
      <section class="security-panel">
        <div class="security-panel__head">
          <h3>Server Access</h3>
          <p>This server is locked with a password. Unlock it to load meetings and live state.</p>
        </div>
        <div class="security-panel__body">
          <input
            class="field-input"
            onInput={(event) => {
              props.onPasswordChange(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                props.onUnlock();
              }
            }}
            placeholder="Server password"
            type="password"
            value={props.password}
          />
          <div class="toolbar-actions">
            <button class="button button--primary" onClick={props.onUnlock} type="button">
              Unlock
            </button>
            <button class="button button--secondary" onClick={props.onLock} type="button">
              Lock
            </button>
          </div>
        </div>
      </section>
    </Show>
  );
}
