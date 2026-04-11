import {
  type Component,
  type OverlayOptions,
  ProcessTerminal,
  TUI,
  type OverlayHandle,
} from "@mariozechner/pi-tui";

import type { GranolaAppApi, GranolaAppState, GranolaAppStateEvent } from "../app/index.ts";

import { handleWorkspaceInput } from "./workspace-input.ts";
import { GranolaTuiWorkspaceBrowseController } from "./workspace-browse.ts";
import { GranolaTuiWorkspaceOverlayController } from "./workspace-overlays.ts";
import {
  currentDetailBody,
  detailScrollStep,
  renderWorkspace,
  type GranolaTuiWorkspaceViewModel,
  resolveWorkspaceLayout,
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
  #overlays: GranolaTuiWorkspaceOverlayController;
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
    this.#overlays = new GranolaTuiWorkspaceOverlayController({
      app,
      browse: this.#browse,
      getViewModel: () => this.viewModel(),
      onWorkspaceFocus: () => {
        this.tui.setFocus(this);
      },
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
    this.#overlays.dispose();
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

  handleInput(data: string): void {
    handleWorkspaceInput(data, {
      activePane: this.#activePane,
      cycleTab: (delta) => {
        this.cycleTab(delta);
      },
      exportArchive: () => {
        void this.#overlays.exportArchive();
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
        this.#overlays.openAuthPanel();
      },
      openAutomation: () => {
        this.#overlays.openAutomationPanel();
      },
      openQuickOpen: () => {
        this.#overlays.openQuickOpen();
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
