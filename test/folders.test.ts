import { describe, expect, test } from "vite-plus/test";

import {
  buildFolderRecord,
  filterFolders,
  renderFolderList,
  renderFolderView,
  resolveFolder,
  resolveFolderQuery,
} from "../src/folders.ts";
import type { GranolaFolder } from "../src/types.ts";
import type { MeetingSummaryRecord } from "../src/app/models.ts";

const folders: GranolaFolder[] = [
  {
    createdAt: "2024-01-01T00:00:00Z",
    documentIds: ["doc-alpha-1111", "doc-bravo-2222"],
    id: "folder-sales-1111",
    isFavourite: true,
    name: "Sales",
    updatedAt: "2024-02-01T00:00:00Z",
    workspaceId: "workspace-1",
  },
  {
    createdAt: "2024-01-05T00:00:00Z",
    description: "Operational reviews",
    documentIds: ["doc-charlie-3333"],
    id: "folder-ops-2222",
    isFavourite: false,
    name: "Ops",
    updatedAt: "2024-01-06T00:00:00Z",
  },
];

const meetings: MeetingSummaryRecord[] = [
  {
    createdAt: "2024-01-01T09:00:00Z",
    folders: [],
    id: "doc-alpha-1111",
    noteContentSource: "notes",
    tags: ["sales"],
    title: "Alpha Sync",
    transcriptLoaded: true,
    transcriptSegmentCount: 2,
    updatedAt: "2024-02-01T10:00:00Z",
  },
];

describe("folders helpers", () => {
  test("filters and resolves folders by id or name", () => {
    const filtered = filterFolders(
      folders.map((folder) => ({ ...folder, documentCount: folder.documentIds.length })),
      {
        limit: 10,
        search: "sales",
      },
    );

    expect(filtered).toHaveLength(1);
    expect(resolveFolder(filtered, "folder-sales").id).toBe("folder-sales-1111");
    expect(resolveFolderQuery(filtered, "Sales").id).toBe("folder-sales-1111");
  });

  test("renders folder list and folder detail output", () => {
    const sales = {
      createdAt: folders[0]!.createdAt,
      description: folders[0]!.description,
      documentCount: folders[0]!.documentIds.length,
      id: folders[0]!.id,
      isFavourite: folders[0]!.isFavourite,
      name: folders[0]!.name,
      updatedAt: folders[0]!.updatedAt,
      workspaceId: folders[0]!.workspaceId,
    };
    const listText = renderFolderList([sales], "text");
    const detailText = renderFolderView(buildFolderRecord(folders[0]!, meetings), "text");

    expect(listText).toContain("Sales");
    expect(detailText).toContain("# Sales");
    expect(detailText).toContain("## Meetings");
    expect(detailText).toContain("Alpha Sync");
  });
});
