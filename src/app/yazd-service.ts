import { enabledAutomationActions } from "../automation-actions.ts";
import type { GranolaAutomationActionRegistry } from "../automation-action-registry.ts";
import type { PkmTargetStore } from "../pkm-targets.ts";
import {
  buildGranolaAutomationKnowledgeBaseBundle,
  buildGranolaYazdKnowledgeBaseRef,
  legacyPkmPreviewFromYazdKnowledgeBasePreview,
  legacyPkmSyncResultFromYazdKnowledgeBasePublishResult,
  previewGranolaYazdKnowledgeBasePublish,
  publishGranolaYazdKnowledgeBase,
} from "../yazd-knowledge-bases.ts";
import {
  buildGranolaYazdArtifactBundle,
  buildGranolaYazdSourceChange,
  buildGranolaYazdSourceFetchResult,
  buildGranolaYazdSourceInfo,
  buildGranolaYazdSourceItemSummary,
} from "../yazd-source.ts";

import type {
  GranolaAppSyncEventsResult,
  GranolaAutomationArtefact,
  GranolaAutomationArtefactPublishPreviewResult,
  GranolaAutomationPkmSyncAction,
  GranolaAutomationRulesResult,
  GranolaMeetingBundle,
  GranolaMeetingListOptions,
  GranolaMeetingListResult,
  GranolaPkmTarget,
  GranolaPkmTargetsResult,
  GranolaYazdArtifactBundle,
  GranolaYazdSourceChangesResult,
  GranolaYazdSourceFetchResult,
  GranolaYazdSourceInfo,
  GranolaYazdSourceListOptions,
  GranolaYazdSourceListResult,
} from "./types.ts";

interface GranolaYazdServiceDependencies {
  automationActionRegistry?: GranolaAutomationActionRegistry;
  getAutomationArtefact: (id: string) => Promise<GranolaAutomationArtefact>;
  listAutomationRules: () => Promise<GranolaAutomationRulesResult>;
  listMeetings: (options?: GranolaMeetingListOptions) => Promise<GranolaMeetingListResult>;
  listSyncEvents: (options?: { limit?: number }) => Promise<GranolaAppSyncEventsResult>;
  pkmTargetStore?: PkmTargetStore;
  readMeetingBundleById: (
    id: string,
    options?: { requireCache?: boolean },
  ) => Promise<GranolaMeetingBundle>;
}

export class GranolaYazdService {
  constructor(private readonly deps: GranolaYazdServiceDependencies) {}

  async inspectSource(): Promise<GranolaYazdSourceInfo> {
    return buildGranolaYazdSourceInfo();
  }

  async listSourceItems(
    options: GranolaYazdSourceListOptions = {},
  ): Promise<GranolaYazdSourceListResult> {
    const result = await this.deps.listMeetings({
      folderId: options.folderId,
      limit: options.limit,
      preferIndex: true,
      search: options.search,
      updatedFrom: options.since,
    });

    return {
      items: result.meetings.map((meeting) => buildGranolaYazdSourceItemSummary(meeting)),
      nextCursor: undefined,
      source: result.source,
    };
  }

  async fetchSourceItem(id: string): Promise<GranolaYazdSourceFetchResult> {
    const bundle = await this.deps
      .readMeetingBundleById(id, { requireCache: true })
      .catch(async () => await this.deps.readMeetingBundleById(id));
    return buildGranolaYazdSourceFetchResult(bundle);
  }

  async buildSourceArtifacts(id: string): Promise<GranolaYazdArtifactBundle> {
    const bundle = await this.deps
      .readMeetingBundleById(id, { requireCache: true })
      .catch(async () => await this.deps.readMeetingBundleById(id));
    return buildGranolaYazdArtifactBundle(bundle);
  }

  async listSourceChanges(
    options: { cursor?: string; limit?: number; since?: string } = {},
  ): Promise<GranolaYazdSourceChangesResult> {
    const cursor = options.cursor?.trim() || undefined;
    const sinceTimestamp = options.since?.trim() ? Date.parse(options.since) : undefined;
    const events = (await this.deps.listSyncEvents({ limit: options.limit ?? 50 })).events.filter(
      (event) => {
        if (cursor && event.id === cursor) {
          return false;
        }

        if (sinceTimestamp == null || Number.isNaN(sinceTimestamp)) {
          return true;
        }

        const occurredAt = Date.parse(event.occurredAt);
        return Number.isNaN(occurredAt) ? true : occurredAt >= sinceTimestamp;
      },
    );

    return {
      changes: events.map((event) => buildGranolaYazdSourceChange(event)),
      nextCursor: undefined,
    };
  }

  async listKnowledgeBases(): Promise<GranolaPkmTargetsResult> {
    return {
      targets: await this.readKnowledgeBases(),
    };
  }

  async previewAutomationArtefactPublish(
    id: string,
    options: { targetId?: string } = {},
  ): Promise<GranolaAutomationArtefactPublishPreviewResult> {
    const artefact = await this.deps.getAutomationArtefact(id);
    const targets = await this.resolveArtefactKnowledgeBases(artefact);
    if (targets.length === 0) {
      return {
        artefactId: artefact.id,
        message: "No linked knowledge base is configured for this artefact.",
        targets: [],
      };
    }

    const selectedTarget =
      (options.targetId
        ? targets.find((candidate) => candidate.id === options.targetId)
        : undefined) ?? targets[0];
    if (!selectedTarget) {
      throw new Error(`linked knowledge base not found for artefact: ${id}`);
    }

    const bundle = await this.deps.readMeetingBundleById(artefact.meetingId);
    return {
      artefactId: artefact.id,
      preview: legacyPkmPreviewFromYazdKnowledgeBasePreview(
        await previewGranolaYazdKnowledgeBasePublish({
          bundle: buildGranolaAutomationKnowledgeBaseBundle({
            artefact,
            bundle,
          }),
          knowledgeBase: buildGranolaYazdKnowledgeBaseRef(selectedTarget),
        }),
      ),
      selectedTargetId: selectedTarget.id,
      targets,
    };
  }

  async runAutomationPkmSync(
    meetingId: string,
    action: GranolaAutomationPkmSyncAction,
    artefact: GranolaAutomationArtefact,
  ): Promise<{
    dailyNoteFilePath?: string;
    dailyNoteOpenUrl?: string;
    filePath: string;
    noteOpenUrl?: string;
    targetId: string;
    transcriptFilePath?: string;
    transcriptOpenUrl?: string;
  }> {
    const target = (await this.readKnowledgeBases()).find(
      (candidate) => candidate.id === action.targetId,
    );
    if (!target) {
      throw new Error(`automation knowledge base not found: ${action.targetId}`);
    }

    const bundle = await this.deps.readMeetingBundleById(meetingId);
    const result = legacyPkmSyncResultFromYazdKnowledgeBasePublishResult(
      await publishGranolaYazdKnowledgeBase({
        bundle: buildGranolaAutomationKnowledgeBaseBundle({
          artefact,
          bundle,
        }),
        knowledgeBase: buildGranolaYazdKnowledgeBaseRef(target),
      }),
    );

    return {
      dailyNoteFilePath: result.dailyNoteFilePath,
      dailyNoteOpenUrl: result.dailyNoteOpenUrl,
      filePath: result.filePath,
      noteOpenUrl: result.noteOpenUrl,
      targetId: target.id,
      transcriptFilePath: result.transcriptFilePath,
      transcriptOpenUrl: result.transcriptOpenUrl,
    };
  }

  private async readKnowledgeBases(): Promise<GranolaPkmTarget[]> {
    if (!this.deps.pkmTargetStore) {
      return [];
    }

    return (await this.deps.pkmTargetStore.readTargets()).map((target) => ({ ...target }));
  }

  private async resolveArtefactKnowledgeBases(
    artefact: GranolaAutomationArtefact,
  ): Promise<GranolaPkmTarget[]> {
    const rule = (await this.deps.listAutomationRules()).rules.find(
      (candidate) => candidate.id === artefact.ruleId,
    );
    if (!rule) {
      return [];
    }

    const linkedTargetIds = enabledAutomationActions(rule, {
      registry: this.deps.automationActionRegistry,
      sourceActionId: artefact.actionId,
      trigger: "approval",
    })
      .filter(
        (action): action is GranolaAutomationPkmSyncAction =>
          action.kind === "pkm-sync" && Boolean(action.targetId),
      )
      .map((action) => action.targetId);

    if (linkedTargetIds.length === 0) {
      return [];
    }

    const targetsById = new Map(
      (await this.readKnowledgeBases()).map((target) => [target.id, target]),
    );
    return [...new Set(linkedTargetIds)]
      .map((targetId) => targetsById.get(targetId))
      .filter((target): target is GranolaPkmTarget => Boolean(target))
      .map((target) => ({ ...target }));
  }
}
