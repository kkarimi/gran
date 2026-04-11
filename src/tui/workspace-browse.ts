import type {
  FolderSummaryRecord,
  GranolaAutomationActionRun,
  GranolaAutomationArtefact,
  GranolaAppState,
  GranolaMeetingBundle,
  GranolaProcessingIssue,
  MeetingSummaryRecord,
  MeetingSummarySource,
} from "../app/index.ts";

import type { GranolaTuiStatusTone, GranolaTuiWorkspaceTab } from "./types.ts";
import type { GranolaTuiApp, GranolaTuiHost } from "./workspace.ts";
import type { GranolaTuiWorkspaceViewModel } from "./workspace-render.ts";

interface GranolaTuiWorkspaceBrowseControllerOptions {
  readonly maxMeetings: number;
  readonly setStatus: (message: string, tone?: GranolaTuiStatusTone) => void;
  readonly tui: GranolaTuiHost;
}

export class GranolaTuiWorkspaceBrowseController {
  readonly #maxMeetings: number;
  readonly #setStatus: (message: string, tone?: GranolaTuiStatusTone) => void;
  readonly #tui: GranolaTuiHost;

  #automationArtefacts: GranolaAutomationArtefact[] = [];
  #automationRuns: GranolaAutomationActionRun[] = [];
  #detailError = "";
  #detailScroll = 0;
  #detailToken = 0;
  #folderError = "";
  #folderToken = 0;
  #folders: FolderSummaryRecord[] = [];
  #listError = "";
  #listToken = 0;
  #loadingDetail = false;
  #loadingMeetings = false;
  #meetingSource: MeetingSummarySource = "live";
  #meetings: MeetingSummaryRecord[] = [];
  #processingIssues: GranolaProcessingIssue[] = [];
  #recentMeetingIds: string[] = [];
  #selectedFolderId?: string;
  #selectedMeeting?: GranolaMeetingBundle;
  #selectedMeetingId?: string;

  constructor(
    private readonly app: GranolaTuiApp,
    options: GranolaTuiWorkspaceBrowseControllerOptions,
  ) {
    this.#maxMeetings = options.maxMeetings;
    this.#setStatus = options.setStatus;
    this.#tui = options.tui;
  }

  get automationArtefacts(): GranolaAutomationArtefact[] {
    return this.#automationArtefacts;
  }

  get automationRuns(): GranolaAutomationActionRun[] {
    return this.#automationRuns;
  }

  get processingIssues(): GranolaProcessingIssue[] {
    return this.#processingIssues;
  }

  get detailScroll(): number {
    return this.#detailScroll;
  }

  scrollDetail(delta: number): void {
    this.#detailScroll = Math.max(0, this.#detailScroll + delta);
    this.#tui.requestRender();
  }

  resetDetailScroll(): void {
    this.#detailScroll = 0;
  }

  get loadingMeetings(): boolean {
    return this.#loadingMeetings;
  }

  get meetingSource(): MeetingSummarySource {
    return this.#meetingSource;
  }

  get selectedMeetingId(): string | undefined {
    return this.#selectedMeetingId;
  }

  get selectedMeeting(): GranolaMeetingBundle | undefined {
    return this.#selectedMeeting;
  }

  viewModel(
    activePane: GranolaTuiWorkspaceViewModel["activePane"],
    appState: GranolaAppState,
    statusMessage: string,
    statusTone: GranolaTuiStatusTone,
    tab: GranolaTuiWorkspaceTab,
  ): GranolaTuiWorkspaceViewModel {
    return {
      activePane,
      appState,
      detailError: this.#detailError,
      detailScroll: this.#detailScroll,
      folderError: this.#folderError,
      folders: this.#folders,
      listError: this.#listError,
      loadingDetail: this.#loadingDetail,
      loadingMeetings: this.#loadingMeetings,
      meetingSource: this.#meetingSource,
      meetings: this.#meetings,
      recentMeetingIds: this.#recentMeetingIds,
      selectedFolderId: this.#selectedFolderId,
      selectedMeeting: this.#selectedMeeting,
      selectedMeetingId: this.#selectedMeetingId,
      statusMessage,
      statusTone,
      tab,
    };
  }

  async loadAutomationRuns(): Promise<void> {
    try {
      const result = await this.app.listAutomationRuns({ limit: 20 });
      this.#automationRuns = [...result.runs];
      this.#tui.requestRender();
    } catch {
      // Automation visibility should not break the rest of the workspace.
    }
  }

  async loadAutomationArtefacts(): Promise<void> {
    try {
      const result = await this.app.listAutomationArtefacts({ limit: 20 });
      this.#automationArtefacts = [...result.artefacts];
      this.#tui.requestRender();
    } catch {
      // Automation visibility should not break the rest of the workspace.
    }
  }

  async loadProcessingIssues(): Promise<void> {
    try {
      const result = await this.app.listProcessingIssues({ limit: 20 });
      this.#processingIssues = [...result.issues];
      this.#tui.requestRender();
    } catch {
      // Processing visibility should not break the rest of the workspace.
    }
  }

  async loadFolders(
    options: {
      forceRefresh?: boolean;
      setStatus?: boolean;
    } = {},
  ): Promise<void> {
    const token = ++this.#folderToken;
    this.#folderError = "";
    if (options.setStatus) {
      this.#setStatus(options.forceRefresh ? "Refreshing folders…" : "Loading folders…");
    }

    try {
      const result = await this.app.listFolders({
        forceRefresh: options.forceRefresh,
        limit: 100,
      });

      if (token !== this.#folderToken) {
        return;
      }

      this.#folders = [...result.folders];
      if (
        this.#selectedFolderId &&
        !this.#folders.some((folder) => folder.id === this.#selectedFolderId)
      ) {
        this.#selectedFolderId = undefined;
      }
      this.#folderError = "";
    } catch (error) {
      if (token !== this.#folderToken) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.#folderError = message;
      this.#folders = [];
      this.#selectedFolderId = undefined;
      this.#setStatus(message, "error");
    } finally {
      if (token === this.#folderToken) {
        this.#tui.requestRender();
      }
    }
  }

  async loadMeetings(
    options: {
      forceRefresh?: boolean;
      preferredMeetingId?: string;
      setStatus?: boolean;
    } = {},
  ): Promise<void> {
    const token = ++this.#listToken;
    this.#loadingMeetings = true;
    this.#listError = "";
    if (options.setStatus !== false) {
      this.#setStatus(options.forceRefresh ? "Refreshing meetings…" : "Loading meetings…");
    }

    try {
      const result = await this.app.listMeetings({
        folderId: this.#selectedFolderId,
        forceRefresh: options.forceRefresh,
        limit: this.#maxMeetings,
        preferIndex: true,
      });

      if (token !== this.#listToken) {
        return;
      }

      this.#meetings = [...result.meetings];
      this.#meetingSource = result.source;
      let nextSelectedMeetingId: string | undefined;
      if (
        options.preferredMeetingId &&
        this.#meetings.some((meeting) => meeting.id === options.preferredMeetingId)
      ) {
        nextSelectedMeetingId = options.preferredMeetingId;
      } else if (
        this.#selectedMeetingId &&
        this.#meetings.some((meeting) => meeting.id === this.#selectedMeetingId)
      ) {
        nextSelectedMeetingId = this.#selectedMeetingId;
      } else {
        nextSelectedMeetingId = this.#meetings[0]?.id;
      }
      this.#selectedMeetingId = nextSelectedMeetingId;
      if (!this.#selectedMeetingId) {
        this.#selectedMeeting = undefined;
        this.#detailError = "";
        this.#detailScroll = 0;
      }
      this.#listError = "";
      this.#setStatus(
        result.source === "index"
          ? "Loaded meetings from the local index"
          : result.source === "snapshot"
            ? "Loaded meetings from the local snapshot"
            : this.#selectedFolderId
              ? "Connected to Granola (folder scope)"
              : "Connected to Granola",
      );
    } catch (error) {
      if (token !== this.#listToken) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.#listError = message;
      this.#setStatus(message, "error");
      throw error;
    } finally {
      if (token === this.#listToken) {
        this.#loadingMeetings = false;
        this.#tui.requestRender();
      }
    }
  }

  async loadMeeting(
    meetingId: string,
    options: {
      ensureMeetingVisible?: boolean;
      recordRecent?: boolean;
      resolveQuery?: boolean;
    } = {},
  ): Promise<void> {
    const token = ++this.#detailToken;
    this.#loadingDetail = true;
    this.#detailError = "";
    this.#selectedMeetingId = meetingId;
    this.#detailScroll = 0;
    this.#setStatus(`Opening ${meetingId}…`);

    try {
      const bundle = options.resolveQuery
        ? await this.app.findMeeting(meetingId)
        : await this.app.getMeeting(meetingId);
      if (token !== this.#detailToken) {
        return;
      }

      this.#selectedMeeting = bundle;
      this.#selectedMeetingId = bundle.source.document.id;
      if (options.recordRecent !== false) {
        this.#recentMeetingIds = [
          bundle.source.document.id,
          ...this.#recentMeetingIds.filter((candidate) => candidate !== bundle.source.document.id),
        ].slice(0, 5);
      }
      if (options.ensureMeetingVisible) {
        this.ensureMeetingVisible(bundle.meeting.meeting);
      }
      this.#setStatus(`Opened ${bundle.meeting.meeting.title || bundle.meeting.meeting.id}`);
    } catch (error) {
      if (token !== this.#detailToken) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.#selectedMeeting = undefined;
      this.#detailError = message;
      this.#setStatus(message, "error");
    } finally {
      if (token === this.#detailToken) {
        this.#loadingDetail = false;
        this.#tui.requestRender();
      }
    }
  }

  async refresh(forceRefresh: boolean): Promise<void> {
    try {
      if (forceRefresh) {
        this.#setStatus("Syncing…");
        await this.app.sync();
      }

      await this.loadFolders({
        forceRefresh,
        setStatus: false,
      });
      await this.loadMeetings({
        forceRefresh,
        preferredMeetingId: this.#selectedMeetingId,
      });

      if (this.#selectedMeetingId) {
        await this.loadMeeting(this.#selectedMeetingId, {
          ensureMeetingVisible: true,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message) {
        this.#setStatus(error.message, "error");
      }
    }
  }

  async moveSelection(activePane: string, delta: number): Promise<void> {
    if (activePane === "folders") {
      await this.moveFolderSelection(delta);
      return;
    }

    if (activePane === "recent") {
      await this.moveRecentSelection(delta);
      return;
    }

    await this.moveMeetingSelection(delta);
  }

  async openSelectedMeeting(): Promise<void> {
    if (!this.#selectedMeetingId) {
      return;
    }

    await this.loadMeeting(this.#selectedMeetingId, {
      ensureMeetingVisible: true,
    });
  }

  async clearScope(preferredMeetingId?: string): Promise<void> {
    this.#selectedFolderId = undefined;
    this.#selectedMeeting = undefined;
    this.#detailError = "";
    this.#detailScroll = 0;
    this.#selectedMeetingId = undefined;
    await this.loadMeetings({
      preferredMeetingId,
      setStatus: false,
    });

    if (this.#selectedMeetingId) {
      await this.loadMeeting(this.#selectedMeetingId, {
        ensureMeetingVisible: true,
      });
    }
  }

  async exportArchive(): Promise<void> {
    const folderId = this.#selectedFolderId;
    const scopeLabel = folderId
      ? this.#folders.find((folder) => folder.id === folderId)?.name || folderId
      : "all meetings";
    this.#setStatus(`Exporting ${scopeLabel}…`);

    try {
      const notesResult = await this.app.exportNotes("markdown", {
        folderId,
        scopedOutput: true,
      });
      const transcriptsResult = await this.app.exportTranscripts("text", {
        folderId,
        scopedOutput: true,
      });
      this.#setStatus(
        `Exported ${notesResult.documentCount} notes and ${transcriptsResult.transcriptCount} transcripts`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#setStatus(message, "error");
    }
  }

  private recentMeetings(): MeetingSummaryRecord[] {
    return this.#recentMeetingIds
      .map((meetingId) => this.#meetings.find((meeting) => meeting.id === meetingId))
      .filter((meeting): meeting is MeetingSummaryRecord => meeting !== undefined);
  }

  private normaliseSelectedIndex(): number {
    if (this.#meetings.length === 0) {
      return -1;
    }

    const selectedIndex = this.#selectedMeetingId
      ? this.#meetings.findIndex((meeting) => meeting.id === this.#selectedMeetingId)
      : -1;

    return selectedIndex >= 0 ? selectedIndex : 0;
  }

  private normaliseSelectedFolderIndex(): number {
    if (!this.#selectedFolderId) {
      return 0;
    }

    const selectedIndex = this.#folders.findIndex((folder) => folder.id === this.#selectedFolderId);
    return selectedIndex >= 0 ? selectedIndex + 1 : 0;
  }

  private normaliseSelectedRecentIndex(): number {
    const recentMeetings = this.recentMeetings();
    if (recentMeetings.length === 0) {
      return -1;
    }

    const selectedIndex = this.#selectedMeetingId
      ? recentMeetings.findIndex((meeting) => meeting.id === this.#selectedMeetingId)
      : -1;

    return selectedIndex >= 0 ? selectedIndex : 0;
  }

  private ensureMeetingVisible(meeting: MeetingSummaryRecord): void {
    const existingIndex = this.#meetings.findIndex((item) => item.id === meeting.id);
    if (existingIndex >= 0) {
      this.#meetings[existingIndex] = meeting;
    } else {
      this.#meetings.push(meeting);
    }

    this.#meetings.sort((left, right) => {
      if (left.updatedAt !== right.updatedAt) {
        return right.updatedAt.localeCompare(left.updatedAt);
      }

      return left.title.localeCompare(right.title);
    });
  }

  private async moveMeetingSelection(delta: number): Promise<void> {
    if (this.#meetings.length === 0) {
      return;
    }

    const currentIndex = this.normaliseSelectedIndex();
    const nextIndex = Math.max(0, Math.min(this.#meetings.length - 1, currentIndex + delta));
    const nextMeeting = this.#meetings[nextIndex];
    if (!nextMeeting || nextMeeting.id === this.#selectedMeetingId) {
      return;
    }

    await this.loadMeeting(nextMeeting.id);
  }

  private async moveRecentSelection(delta: number): Promise<void> {
    const recentMeetings = this.recentMeetings();
    if (recentMeetings.length === 0) {
      return;
    }

    const currentIndex = this.normaliseSelectedRecentIndex();
    const nextIndex = Math.max(0, Math.min(recentMeetings.length - 1, currentIndex + delta));
    const nextMeeting = recentMeetings[nextIndex];
    if (!nextMeeting || nextMeeting.id === this.#selectedMeetingId) {
      return;
    }

    await this.loadMeeting(nextMeeting.id, {
      recordRecent: false,
    });
  }

  private async moveFolderSelection(delta: number): Promise<void> {
    const total = this.#folders.length + 1;
    const currentIndex = this.normaliseSelectedFolderIndex();
    const nextIndex = Math.max(0, Math.min(total - 1, currentIndex + delta));
    const nextFolderId = nextIndex === 0 ? undefined : this.#folders[nextIndex - 1]?.id;

    if (nextFolderId === this.#selectedFolderId) {
      return;
    }

    this.#selectedFolderId = nextFolderId;
    this.#selectedMeeting = undefined;
    this.#detailError = "";
    this.#detailScroll = 0;
    this.#selectedMeetingId = undefined;
    await this.loadMeetings({
      setStatus: false,
    });

    const visibleMeetingId =
      this.#selectedMeetingId &&
      this.#meetings.some((meeting) => meeting.id === this.#selectedMeetingId)
        ? this.#selectedMeetingId
        : this.#meetings[0]?.id;

    if (visibleMeetingId) {
      this.#selectedMeetingId = visibleMeetingId;
      await this.loadMeeting(visibleMeetingId, {
        ensureMeetingVisible: true,
      });
      return;
    }

    this.#selectedMeetingId = undefined;
    this.#tui.requestRender();
  }
}
