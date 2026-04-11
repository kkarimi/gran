import {
  type Component,
  type OverlayOptions,
  ProcessTerminal,
  TUI,
  type OverlayHandle,
} from "@mariozechner/pi-tui";

import type {
  GranolaAppApi,
  GranolaAppState,
  GranolaAppAuthState,
  GranolaAppStateEvent,
} from "../app/index.ts";

import { GranolaTuiAutomationOverlay } from "./automation.ts";
import { GranolaTuiAuthOverlay, type GranolaTuiAuthActionId } from "./auth.ts";
import { GranolaTuiQuickOpenPalette } from "./palette.ts";
import { handleWorkspaceInput } from "./workspace-input.ts";
import { GranolaTuiWorkspaceBrowseController } from "./workspace-browse.ts";
import {
  currentDetailBody,
  detailScrollStep,
  renderWorkspace,
  resolveWorkspaceLayout,
  type GranolaTuiWorkspaceViewModel,
} from "./workspace-render.ts";
import type { GranolaTuiFocusPane, GranolaTuiStatusTone, GranolaTuiWorkspaceTab } from "./types.ts";

export interface GranolaTuiHost {
  readonly terminal: {
    columns: number;
    rows: number;
  };
  requestRender(force?: boolean): void;
  setFocus(component: Component | null): void;
  showOverlay(component: Component, options?: OverlayOptions): OverlayHandle;
}

export interface GranolaTuiWorkspaceOptions {
  initialMeetingId?: string;
  maxMeetings?: number;
  onExit: () => void;
}

export interface GranolaTuiApp extends GranolaAppApi {
  close?: () => Promise<void> | void;
}

export class GranolaTuiWorkspace implements Component {
  focused = false;

  #appState: GranolaAppState;
  #browse: GranolaTuiWorkspaceBrowseController;
  #activePane: GranolaTuiFocusPane = "meetings";
  #overlay?: OverlayHandle;
  #statusMessage = "Loading meetings…";
  #statusTone: GranolaTuiStatusTone = "info";
  #tab: GranolaTuiWorkspaceTab = "notes";
  #unsubscribe?: () => void;

  constructor(
    private readonly tui: GranolaTuiHost,
    private readonly app: GranolaTuiApp,
    private readonly options: GranolaTuiWorkspaceOptions,
  ) {
    this.#appState = app.getState();
    this.#browse = new GranolaTuiWorkspaceBrowseController(app, {
      maxMeetings: options.maxMeetings ?? 200,
      setStatus: (message, tone) => {
        this.setStatus(message, tone);
      },
      tui,
    });
  }

  async initialise(): Promise<void> {
    this.#unsubscribe = this.app.subscribe((event) => {
      this.handleAppUpdate(event);
    });

    await this.#browse.loadAutomationRuns();
    await this.#browse.loadAutomationArtefacts();
    await this.#browse.loadProcessingIssues();
    await this.#browse.loadFolders({
      setStatus: false,
    });
    await this.#browse.loadMeetings({
      preferredMeetingId: this.options.initialMeetingId,
      setStatus: true,
    });

    if (this.options.initialMeetingId) {
      await this.#browse.loadMeeting(this.options.initialMeetingId, {
        ensureMeetingVisible: true,
      });
    } else if (this.#browse.selectedMeetingId && this.#appState.documents.loaded) {
      void this.#browse.loadMeeting(this.#browse.selectedMeetingId);
    }
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }

  invalidate(): void {}

  private handleAppUpdate(event: GranolaAppStateEvent): void {
    const previousDocumentsLoadedAt = this.#appState.documents.loadedAt;
    this.#appState = event.state;

    void this.#browse.loadAutomationRuns();
    void this.#browse.loadAutomationArtefacts();
    void this.#browse.loadProcessingIssues();

    if (
      this.#browse.meetingSource === "index" &&
      event.state.documents.loadedAt &&
      event.state.documents.loadedAt !== previousDocumentsLoadedAt &&
      !this.#browse.loadingMeetings
    ) {
      void (async () => {
        await this.#browse.loadFolders({ setStatus: false });
        await this.#browse.loadMeetings({
          preferredMeetingId: this.#browse.selectedMeetingId,
        });
      })();
    }

    this.tui.requestRender();
  }

  private setStatus(message: string, tone: GranolaTuiStatusTone = "info"): void {
    this.#statusMessage = message;
    this.#statusTone = tone;
    this.tui.requestRender();
  }

  private viewModel(): GranolaTuiWorkspaceViewModel {
    return this.#browse.viewModel(
      this.#activePane,
      this.#appState,
      this.#statusMessage,
      this.#statusTone,
      this.#tab,
    );
  }

  private scrollStep(): number {
    const { detailWidth } = resolveWorkspaceLayout(this.tui.terminal.columns);
    return detailScrollStep(this.viewModel(), Math.max(1, detailWidth - 2), this.tui.terminal.rows);
  }

  private scrollDetail(delta: number): void {
    const totalWidth = this.tui.terminal.columns;
    const totalHeight = this.tui.terminal.rows;
    const { detailWidth } = resolveWorkspaceLayout(totalWidth);
    const bodyHeight = Math.max(1, totalHeight - 6);
    const detailLines = currentDetailBody(this.viewModel(), Math.max(1, detailWidth - 2));
    const visibleBodyLines = Math.max(1, bodyHeight - 2);
    const maxScroll = Math.max(0, detailLines.length - visibleBodyLines);
    const nextScroll = Math.max(0, Math.min(maxScroll, this.#browse.detailScroll + delta));

    this.#browse.scrollDetail(nextScroll - this.#browse.detailScroll);
  }

  private cycleTab(delta: number): void {
    const tabs: GranolaTuiWorkspaceTab[] = ["notes", "transcript", "metadata", "raw"];
    const index = tabs.indexOf(this.#tab);
    const nextIndex = (index + delta + tabs.length) % tabs.length;
    this.#tab = tabs[nextIndex] ?? "notes";
    this.#browse.resetDetailScroll();
    this.tui.requestRender();
  }

  private async reloadAfterAuthChange(): Promise<void> {
    const preferredMeetingId =
      this.#browse.selectedMeeting?.source.document.id ?? this.#browse.selectedMeetingId;

    try {
      await this.#browse.loadFolders({
        forceRefresh: true,
        setStatus: false,
      });
      await this.#browse.loadMeetings({
        forceRefresh: true,
        preferredMeetingId,
        setStatus: false,
      });

      if (this.#browse.selectedMeetingId) {
        await this.#browse.loadMeeting(this.#browse.selectedMeetingId, {
          ensureMeetingVisible: true,
        });
        return;
      }

      this.#browse.resetDetailScroll();
      this.tui.requestRender();
    } catch {
      // Status is already updated by the loaders.
    }
  }

  private async runAuthAction(actionId: GranolaTuiAuthActionId): Promise<void> {
    let successMessage = "";

    try {
      switch (actionId) {
        case "login":
          this.setStatus("Importing desktop session…");
          await this.app.loginAuth();
          successMessage = "Stored session imported";
          break;
        case "refresh":
          this.setStatus("Refreshing stored session…");
          await this.app.refreshAuth();
          successMessage = "Stored session refreshed";
          break;
        case "use-api-key":
          this.setStatus("Switching to stored API key…");
          await this.app.switchAuthMode("api-key");
          successMessage = "Using stored API key";
          break;
        case "use-stored":
          this.setStatus("Switching to stored session…");
          await this.app.switchAuthMode("stored-session");
          successMessage = "Using stored session";
          break;
        case "use-supabase":
          this.setStatus("Switching to supabase.json…");
          await this.app.switchAuthMode("supabase-file");
          successMessage = "Using supabase.json";
          break;
        case "logout":
          this.setStatus("Signing out…");
          await this.app.logoutAuth();
          successMessage = "Stored credentials removed";
          break;
      }

      await this.reloadAfterAuthChange();
      this.setStatus(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(message, "error");
    }
  }

  private openAuthPanel(auth: GranolaAppAuthState = this.#appState.auth): void {
    if (this.#overlay) {
      return;
    }

    const closeOverlay = () => {
      this.#overlay?.hide();
      this.#overlay = undefined;
      this.tui.setFocus(this);
      this.tui.requestRender();
    };

    const overlay = new GranolaTuiAuthOverlay({
      auth,
      onCancel: closeOverlay,
      onRun: async (actionId) => {
        closeOverlay();
        await this.runAuthAction(actionId);
      },
    });

    this.#overlay = this.tui.showOverlay(overlay, {
      anchor: "center",
      maxHeight: "70%",
      minWidth: 52,
      width: "72%",
    });
    this.setStatus("Auth session");
  }

  private openQuickOpen(): void {
    if (this.#overlay) {
      return;
    }

    const closeOverlay = () => {
      this.#overlay?.hide();
      this.#overlay = undefined;
      this.tui.setFocus(this);
      this.tui.requestRender();
    };

    const view = this.viewModel();
    const palette = new GranolaTuiQuickOpenPalette({
      meetings: view.meetings,
      onAction: async (actionId) => {
        closeOverlay();
        await this.runQuickOpenAction(actionId);
      },
      onCancel: closeOverlay,
      onPick: async (meetingId) => {
        closeOverlay();
        await this.#browse.loadMeeting(meetingId, {
          ensureMeetingVisible: true,
        });
      },
      onResolveQuery: async (query) => {
        closeOverlay();
        await this.#browse.loadMeeting(query, {
          ensureMeetingVisible: true,
          resolveQuery: true,
        });
      },
      recentMeetingIds: view.recentMeetingIds,
    });

    this.#overlay = this.tui.showOverlay(palette, {
      anchor: "center",
      maxHeight: "60%",
      minWidth: 48,
      width: "70%",
    });
    this.setStatus("Quick open");
  }

  private async exportArchive(): Promise<void> {
    await this.#browse.exportArchive();
  }

  private async runQuickOpenAction(
    actionId: "auth" | "automation" | "clear-scope" | "export" | "sync",
  ) {
    switch (actionId) {
      case "auth":
        this.openAuthPanel();
        return;
      case "automation":
        this.openAutomationPanel();
        return;
      case "export":
        await this.exportArchive();
        return;
      case "clear-scope":
        await this.#browse.clearScope(this.viewModel().recentMeetingIds[0]);
        this.setStatus("Showing all meetings");
        return;
      case "sync":
      default:
        await this.#browse.refresh(true);
    }
  }

  private openAutomationPanel(): void {
    if (this.#overlay) {
      return;
    }

    const closeOverlay = () => {
      this.#overlay?.hide();
      this.#overlay = undefined;
      this.tui.setFocus(this);
      this.tui.requestRender();
    };

    const overlay = new GranolaTuiAutomationOverlay({
      artefacts: this.#browse.automationArtefacts,
      issues: this.#browse.processingIssues,
      onApproveArtefact: async (id) => {
        closeOverlay();
        await this.app.resolveAutomationArtefact(id, "approve");
        await this.#browse.loadAutomationArtefacts();
        this.setStatus("Artefact approved");
      },
      onApproveRun: async (id) => {
        closeOverlay();
        await this.app.resolveAutomationRun(id, "approve");
        await this.#browse.loadAutomationRuns();
        this.setStatus("Automation approved");
      },
      onCancel: closeOverlay,
      onRejectArtefact: async (id) => {
        closeOverlay();
        await this.app.resolveAutomationArtefact(id, "reject");
        await this.#browse.loadAutomationArtefacts();
        this.setStatus("Artefact rejected");
      },
      onRejectRun: async (id) => {
        closeOverlay();
        await this.app.resolveAutomationRun(id, "reject");
        await this.#browse.loadAutomationRuns();
        this.setStatus("Automation rejected");
      },
      onRecoverIssue: async (id) => {
        closeOverlay();
        const result = await this.app.recoverProcessingIssue(id);
        await this.#browse.loadProcessingIssues();
        await this.#browse.loadAutomationArtefacts();
        await this.#browse.loadAutomationRuns();
        this.setStatus(
          result.runCount > 0
            ? `Recovered ${result.issue.kind} and re-ran ${result.runCount} pipeline${result.runCount === 1 ? "" : "s"}`
            : `Recovered ${result.issue.kind}`,
        );
      },
      onRerunArtefact: async (id) => {
        closeOverlay();
        await this.app.rerunAutomationArtefact(id);
        await this.#browse.loadAutomationArtefacts();
        await this.#browse.loadAutomationRuns();
        this.setStatus("Artefact rerun complete");
      },
      runs: this.#browse.automationRuns,
    });

    this.#overlay = this.tui.showOverlay(overlay, {
      anchor: "center",
      maxHeight: "70%",
      minWidth: 56,
      width: "76%",
    });
    this.setStatus("Review inbox");
  }

  handleInput(data: string): void {
    handleWorkspaceInput(data, {
      activePane: this.#activePane,
      cycleTab: (delta) => {
        this.cycleTab(delta);
      },
      exportArchive: () => {
        void this.exportArchive();
      },
      exit: () => {
        this.options.onExit();
      },
      moveSelection: (delta) => {
        void this.#browse.moveSelection(this.#activePane, delta);
      },
      openSelectedMeeting: () => {
        void this.#browse.openSelectedMeeting();
      },
      openAuth: () => {
        this.openAuthPanel();
      },
      openAutomation: () => {
        this.openAutomationPanel();
      },
      openQuickOpen: () => {
        this.openQuickOpen();
      },
      refresh: (forceRefresh) => {
        void this.#browse.refresh(forceRefresh);
      },
      requestRender: () => {
        this.tui.requestRender();
      },
      scrollDetail: (delta) => {
        this.scrollDetail(delta);
      },
      scrollStep: () => this.scrollStep(),
      selectTab: (tab) => {
        this.#tab = tab;
        this.#browse.resetDetailScroll();
        this.tui.requestRender();
      },
      setActivePane: (pane) => {
        this.#activePane = pane;
      },
    });
  }

  render(width: number): string[] {
    return renderWorkspace(this.viewModel(), width, Math.max(12, this.tui.terminal.rows));
  }
}

export async function runGranolaTui(
  app: GranolaTuiApp,
  options: {
    initialMeetingId?: string;
    onClose?: () => Promise<void> | void;
  } = {},
): Promise<number> {
  const tui = new TUI(new ProcessTerminal());

  return await new Promise<number>((resolve, reject) => {
    const workspace = new GranolaTuiWorkspace(tui, app, {
      initialMeetingId: options.initialMeetingId,
      onExit: () => {
        workspace.dispose();
        tui.stop();
        Promise.resolve(options.onClose?.())
          .then(() => Promise.resolve(app.close?.()))
          .catch(() => {
            // Best-effort shutdown for remote clients.
          })
          .finally(() => {
            resolve(0);
          });
      },
    });

    void (async () => {
      try {
        await workspace.initialise();
      } catch (error) {
        workspace.dispose();
        await Promise.resolve(options.onClose?.())
          .then(() => Promise.resolve(app.close?.()))
          .catch(() => {
            // Best-effort shutdown for remote clients.
          });
        reject(error);
        return;
      }

      tui.addChild(workspace);
      tui.setFocus(workspace);
      tui.start();
      tui.requestRender(true);
    })();
  });
}
