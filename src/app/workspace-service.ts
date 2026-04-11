import {
  buildFolderRecord,
  buildFolderSummary,
  filterFolders,
  resolveFolder,
  resolveFolderQuery,
} from "../folders.ts";
import { filterMeetingSummaries, listMeetings } from "../meetings.ts";
import type { GranolaFolder } from "../types.ts";

import { GranolaCatalogService, type GranolaCatalogLiveSnapshot } from "./catalog.ts";
import { GranolaIndexService } from "./index-service.ts";
import type { FolderRecord, FolderSummaryRecord, MeetingSummaryRecord } from "./models.ts";
import type {
  GranolaAppState,
  GranolaFolderListOptions,
  GranolaFolderListResult,
  GranolaMeetingBundle,
  GranolaMeetingListOptions,
  GranolaMeetingListResult,
} from "./types.ts";

function cloneFolderSummary(folder: FolderSummaryRecord): FolderSummaryRecord {
  return { ...folder };
}

function deriveFolderSummariesFromMeetings(
  meetings: MeetingSummaryRecord[],
): FolderSummaryRecord[] {
  const foldersById = new Map<
    string,
    {
      folder: FolderSummaryRecord;
      meetingIds: Set<string>;
    }
  >();

  for (const meeting of meetings) {
    for (const folder of meeting.folders) {
      const existing = foldersById.get(folder.id);
      if (existing) {
        existing.meetingIds.add(meeting.id);
        existing.folder = {
          ...existing.folder,
          createdAt:
            existing.folder.createdAt.localeCompare(folder.createdAt) <= 0
              ? existing.folder.createdAt
              : folder.createdAt,
          description: existing.folder.description ?? folder.description,
          documentCount: Math.max(existing.folder.documentCount, folder.documentCount),
          isFavourite: existing.folder.isFavourite || folder.isFavourite,
          updatedAt:
            existing.folder.updatedAt.localeCompare(folder.updatedAt) >= 0
              ? existing.folder.updatedAt
              : folder.updatedAt,
          workspaceId: existing.folder.workspaceId ?? folder.workspaceId,
        };
        continue;
      }

      foldersById.set(folder.id, {
        folder: cloneFolderSummary(folder),
        meetingIds: new Set([meeting.id]),
      });
    }
  }

  return [...foldersById.values()]
    .map(({ folder, meetingIds }) => ({
      ...folder,
      documentCount: Math.max(folder.documentCount, meetingIds.size),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

interface GranolaWorkspaceServiceDependencies {
  catalog: GranolaCatalogService;
  emitStateUpdate: () => void;
  index: GranolaIndexService;
  nowIso: () => string;
  state: GranolaAppState;
  syncInBackground: () => Promise<void>;
}

export class GranolaWorkspaceService {
  constructor(private readonly deps: GranolaWorkspaceServiceDependencies) {}

  private buildFoldersByDocumentId(
    folders: GranolaFolder[] | undefined,
  ): Map<string, FolderSummaryRecord[]> | undefined {
    return this.deps.catalog.buildFoldersByDocumentId(folders);
  }

  private async liveMeetingSnapshot(
    options: { forceRefresh?: boolean } = {},
  ): Promise<GranolaCatalogLiveSnapshot> {
    return await this.deps.catalog.liveMeetingSnapshot(options);
  }

  async listFolders(options: GranolaFolderListOptions = {}): Promise<GranolaFolderListResult> {
    if (!options.forceRefresh && this.deps.index.hasMeetings()) {
      const summaries = filterFolders(
        deriveFolderSummariesFromMeetings(this.deps.index.meetings()),
        {
          limit: options.limit,
          search: options.search,
        },
      );

      if (summaries.length > 0) {
        this.deps.state.folders = {
          count: summaries.length,
          loaded: true,
          loadedAt: this.deps.nowIso(),
          source: "index",
        };
        this.deps.emitStateUpdate();
        return {
          folders: summaries,
        };
      }
    }

    const folders = await this.deps.catalog.loadFolders({
      forceRefresh: options.forceRefresh,
      required: true,
    });
    const summaries = filterFolders(
      (folders ?? []).map((folder) => buildFolderSummary(folder)),
      {
        limit: options.limit,
        search: options.search,
      },
    );

    return {
      folders: summaries,
    };
  }

  async getFolder(id: string): Promise<FolderRecord> {
    const folders = await this.deps.catalog.loadFolders({ required: true });
    const cacheData = await this.deps.catalog.loadCache();
    const documents = await this.deps.catalog.listDocuments();
    const summaries = (folders ?? []).map((folder) => buildFolderSummary(folder));
    const folder = resolveFolder(summaries, id);
    const rawFolder = (folders ?? []).find((candidate) => candidate.id === folder.id);
    if (!rawFolder) {
      throw new Error(`folder not found: ${id}`);
    }

    const meetings = listMeetings(documents, {
      cacheData,
      folderId: folder.id,
      foldersByDocumentId: this.buildFoldersByDocumentId(folders),
      limit: Math.max(rawFolder.documentIds.length, 1),
      sort: "updated-desc",
    });

    return buildFolderRecord(rawFolder, meetings);
  }

  async findFolder(query: string): Promise<FolderRecord> {
    const folders = await this.deps.catalog.loadFolders({ required: true });
    const summary = resolveFolderQuery(
      (folders ?? []).map((folder) => buildFolderSummary(folder)),
      query,
    );
    return await this.getFolder(summary.id);
  }

  async listMeetings(options: GranolaMeetingListOptions = {}): Promise<GranolaMeetingListResult> {
    const preferIndex =
      options.preferIndex ??
      (this.deps.state.ui.surface === "web" || this.deps.state.ui.surface === "server");
    const canUseSearchIndex =
      Boolean(options.search?.trim()) && !options.forceRefresh && this.deps.index.hasSearchIndex();

    if (
      !options.forceRefresh &&
      preferIndex &&
      this.deps.index.hasMeetings() &&
      (canUseSearchIndex || !this.deps.state.documents.loaded)
    ) {
      const meetings = canUseSearchIndex
        ? this.deps.index.indexedMeetingsForSearch({
            folderId: options.folderId,
            limit: options.limit,
            search: options.search!,
            sort: options.sort,
            updatedFrom: options.updatedFrom,
            updatedTo: options.updatedTo,
          })
        : filterMeetingSummaries(this.deps.index.meetings(), options);
      if (!(options.folderId && meetings.length === 0)) {
        this.deps.index.triggerBackgroundRefresh(async () => {
          try {
            await this.deps.syncInBackground();
          } catch {
            // Opportunistic background sync should not break the foreground view.
          }
        });
        return {
          meetings,
          source: "index",
        };
      }
    }

    const snapshot = await this.liveMeetingSnapshot({
      forceRefresh: options.forceRefresh,
    });
    if (options.folderId && !snapshot.folders) {
      throw new Error("Gran folder API is not configured");
    }

    const meetings = listMeetings(snapshot.documents, {
      cacheData: snapshot.cacheData,
      folderId: options.folderId,
      foldersByDocumentId: this.buildFoldersByDocumentId(snapshot.folders),
      limit: options.limit,
      search: options.search,
      sort: options.sort,
      updatedFrom: options.updatedFrom,
      updatedTo: options.updatedTo,
    });

    await this.deps.index.persistMeetingIndex(snapshot.meetings);

    return {
      meetings,
      source: this.deps.state.documents.source === "snapshot" ? "snapshot" : "live",
    };
  }

  async getMeeting(
    id: string,
    options: { requireCache?: boolean } = {},
  ): Promise<GranolaMeetingBundle> {
    return await this.deps.catalog.readMeetingBundleById(id, options);
  }

  async findMeeting(
    query: string,
    options: { requireCache?: boolean } = {},
  ): Promise<GranolaMeetingBundle> {
    try {
      return await this.deps.catalog.readMeetingBundleByQuery(query, options);
    } catch (error) {
      const fallbackId = this.deps.index.searchFallbackMeetingId(query);
      if (!fallbackId) {
        throw error;
      }

      return await this.deps.catalog.readMeetingBundleById(fallbackId, options);
    }
  }
}
