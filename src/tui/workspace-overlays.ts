import { GranolaTuiAutomationOverlay } from "./automation.ts";
import { GranolaTuiAuthOverlay, type GranolaTuiAuthActionId } from "./auth.ts";
import { GranolaTuiQuickOpenPalette } from "./palette.ts";
import type { GranolaTuiStatusTone } from "./types.ts";
import type { GranolaTuiApp, GranolaTuiHost } from "./workspace.ts";
import type { GranolaTuiWorkspaceBrowseController } from "./workspace-browse.ts";
import type { GranolaTuiWorkspaceViewModel } from "./workspace-render.ts";

interface GranolaTuiWorkspaceOverlayControllerOptions {
  readonly app: GranolaTuiApp;
  readonly browse: GranolaTuiWorkspaceBrowseController;
  readonly getViewModel: () => GranolaTuiWorkspaceViewModel;
  readonly onWorkspaceFocus: () => void;
  readonly setStatus: (message: string, tone?: GranolaTuiStatusTone) => void;
  readonly tui: GranolaTuiHost;
}

export class GranolaTuiWorkspaceOverlayController {
  #overlay?: ReturnType<GranolaTuiHost["showOverlay"]>;

  constructor(private readonly options: GranolaTuiWorkspaceOverlayControllerOptions) {}

  dispose(): void {
    this.#overlay?.hide();
    this.#overlay = undefined;
  }

  private closeOverlay(): void {
    this.#overlay?.hide();
    this.#overlay = undefined;
    this.options.onWorkspaceFocus();
    this.options.tui.requestRender();
  }

  private async reloadAfterAuthChange(): Promise<void> {
    const preferredMeetingId =
      this.options.browse.selectedMeeting?.source.document.id ??
      this.options.browse.selectedMeetingId;

    try {
      await this.options.browse.loadFolders({
        forceRefresh: true,
        setStatus: false,
      });
      await this.options.browse.loadMeetings({
        forceRefresh: true,
        preferredMeetingId,
        setStatus: false,
      });

      if (this.options.browse.selectedMeetingId) {
        await this.options.browse.loadMeeting(this.options.browse.selectedMeetingId, {
          ensureMeetingVisible: true,
        });
        return;
      }

      this.options.browse.resetDetailScroll();
      this.options.tui.requestRender();
    } catch {
      // Status is already updated by the loaders.
    }
  }

  private async runAuthAction(actionId: GranolaTuiAuthActionId): Promise<void> {
    let successMessage = "";

    try {
      switch (actionId) {
        case "login":
          this.options.setStatus("Importing desktop session…");
          await this.options.app.loginAuth();
          successMessage = "Stored session imported";
          break;
        case "refresh":
          this.options.setStatus("Refreshing stored session…");
          await this.options.app.refreshAuth();
          successMessage = "Stored session refreshed";
          break;
        case "use-api-key":
          this.options.setStatus("Switching to stored API key…");
          await this.options.app.switchAuthMode("api-key");
          successMessage = "Using stored API key";
          break;
        case "use-stored":
          this.options.setStatus("Switching to stored session…");
          await this.options.app.switchAuthMode("stored-session");
          successMessage = "Using stored session";
          break;
        case "use-supabase":
          this.options.setStatus("Switching to supabase.json…");
          await this.options.app.switchAuthMode("supabase-file");
          successMessage = "Using supabase.json";
          break;
        case "logout":
          this.options.setStatus("Signing out…");
          await this.options.app.logoutAuth();
          successMessage = "Stored credentials removed";
          break;
      }

      await this.reloadAfterAuthChange();
      this.options.setStatus(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.setStatus(message, "error");
    }
  }

  openAuthPanel(): void {
    if (this.#overlay) {
      return;
    }

    const closeOverlay = () => {
      this.closeOverlay();
    };

    const overlay = new GranolaTuiAuthOverlay({
      auth: this.options.getViewModel().appState.auth,
      onCancel: closeOverlay,
      onRun: async (actionId) => {
        closeOverlay();
        await this.runAuthAction(actionId);
      },
    });

    this.#overlay = this.options.tui.showOverlay(overlay, {
      anchor: "center",
      maxHeight: "70%",
      minWidth: 52,
      width: "72%",
    });
    this.options.setStatus("Auth session");
  }

  openQuickOpen(): void {
    if (this.#overlay) {
      return;
    }

    const closeOverlay = () => {
      this.closeOverlay();
    };

    const view = this.options.getViewModel();
    const palette = new GranolaTuiQuickOpenPalette({
      meetings: view.meetings,
      onAction: async (actionId) => {
        closeOverlay();
        await this.runQuickOpenAction(actionId);
      },
      onCancel: closeOverlay,
      onPick: async (meetingId) => {
        closeOverlay();
        await this.options.browse.loadMeeting(meetingId, {
          ensureMeetingVisible: true,
        });
      },
      onResolveQuery: async (query) => {
        closeOverlay();
        await this.options.browse.loadMeeting(query, {
          ensureMeetingVisible: true,
          resolveQuery: true,
        });
      },
      recentMeetingIds: view.recentMeetingIds,
    });

    this.#overlay = this.options.tui.showOverlay(palette, {
      anchor: "center",
      maxHeight: "60%",
      minWidth: 48,
      width: "70%",
    });
    this.options.setStatus("Quick open");
  }

  async exportArchive(): Promise<void> {
    await this.options.browse.exportArchive();
  }

  openAutomationPanel(): void {
    if (this.#overlay) {
      return;
    }

    const closeOverlay = () => {
      this.closeOverlay();
    };

    const overlay = new GranolaTuiAutomationOverlay({
      artefacts: this.options.browse.automationArtefacts,
      issues: this.options.browse.processingIssues,
      onApproveArtefact: async (id) => {
        closeOverlay();
        await this.options.app.resolveAutomationArtefact(id, "approve");
        await this.options.browse.loadAutomationArtefacts();
        this.options.setStatus("Artefact approved");
      },
      onApproveRun: async (id) => {
        closeOverlay();
        await this.options.app.resolveAutomationRun(id, "approve");
        await this.options.browse.loadAutomationRuns();
        this.options.setStatus("Automation approved");
      },
      onCancel: closeOverlay,
      onRejectArtefact: async (id) => {
        closeOverlay();
        await this.options.app.resolveAutomationArtefact(id, "reject");
        await this.options.browse.loadAutomationArtefacts();
        this.options.setStatus("Artefact rejected");
      },
      onRejectRun: async (id) => {
        closeOverlay();
        await this.options.app.resolveAutomationRun(id, "reject");
        await this.options.browse.loadAutomationRuns();
        this.options.setStatus("Automation rejected");
      },
      onRecoverIssue: async (id) => {
        closeOverlay();
        const result = await this.options.app.recoverProcessingIssue(id);
        await this.options.browse.loadProcessingIssues();
        await this.options.browse.loadAutomationArtefacts();
        await this.options.browse.loadAutomationRuns();
        this.options.setStatus(
          result.runCount > 0
            ? `Recovered ${result.issue.kind} and re-ran ${result.runCount} pipeline${result.runCount === 1 ? "" : "s"}`
            : `Recovered ${result.issue.kind}`,
        );
      },
      onRerunArtefact: async (id) => {
        closeOverlay();
        await this.options.app.rerunAutomationArtefact(id);
        await this.options.browse.loadAutomationArtefacts();
        await this.options.browse.loadAutomationRuns();
        this.options.setStatus("Artefact rerun complete");
      },
      runs: this.options.browse.automationRuns,
    });

    this.#overlay = this.options.tui.showOverlay(overlay, {
      anchor: "center",
      maxHeight: "70%",
      minWidth: 56,
      width: "76%",
    });
    this.options.setStatus("Review inbox");
  }

  async runQuickOpenAction(actionId: "auth" | "automation" | "clear-scope" | "export" | "sync") {
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
        await this.options.browse.clearScope(this.options.getViewModel().recentMeetingIds[0]);
        this.options.setStatus("Showing all meetings");
        return;
      case "sync":
      default:
        await this.options.browse.refresh(true);
    }
  }
}
