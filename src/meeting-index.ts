import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { MeetingSummaryRecord } from "./app/models.ts";
import { defaultGranolaToolkitPersistenceLayout } from "./persistence/layout.ts";
import { parseJsonString } from "./utils.ts";

const MEETING_INDEX_VERSION = 2;

interface MeetingIndexFile {
  meetings: MeetingSummaryRecord[];
  updatedAt: string;
  version: number;
}

export interface MeetingIndexStore {
  readIndex(): Promise<MeetingSummaryRecord[]>;
  writeIndex(meetings: MeetingSummaryRecord[]): Promise<void>;
}

export class MemoryMeetingIndexStore implements MeetingIndexStore {
  #meetings: MeetingSummaryRecord[] = [];

  async readIndex(): Promise<MeetingSummaryRecord[]> {
    return this.#meetings.map((meeting) => ({
      ...meeting,
      folders: Array.isArray(meeting.folders)
        ? meeting.folders.map((folder) => ({ ...folder }))
        : [],
      tags: [...meeting.tags],
    }));
  }

  async writeIndex(meetings: MeetingSummaryRecord[]): Promise<void> {
    this.#meetings = meetings.map((meeting) => ({
      ...meeting,
      folders: Array.isArray(meeting.folders)
        ? meeting.folders.map((folder) => ({ ...folder }))
        : [],
      tags: [...meeting.tags],
    }));
  }
}

export class FileMeetingIndexStore implements MeetingIndexStore {
  constructor(private readonly filePath: string = defaultMeetingIndexFilePath()) {}

  async readIndex(): Promise<MeetingSummaryRecord[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed = parseJsonString<MeetingIndexFile>(contents);
      if (!parsed || parsed.version !== MEETING_INDEX_VERSION || !Array.isArray(parsed.meetings)) {
        return [];
      }

      return parsed.meetings.map((meeting) => ({
        ...meeting,
        folders: Array.isArray(meeting.folders)
          ? meeting.folders.map((folder) => ({ ...folder }))
          : [],
        tags: [...meeting.tags],
      }));
    } catch {
      return [];
    }
  }

  async writeIndex(meetings: MeetingSummaryRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload: MeetingIndexFile = {
      meetings: meetings.map((meeting) => ({
        ...meeting,
        folders: Array.isArray(meeting.folders)
          ? meeting.folders.map((folder) => ({ ...folder }))
          : [],
        tags: [...meeting.tags],
      })),
      updatedAt: new Date().toISOString(),
      version: MEETING_INDEX_VERSION,
    };
    await writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}

export function defaultMeetingIndexFilePath(): string {
  return defaultGranolaToolkitPersistenceLayout().meetingIndexFile;
}

export function createDefaultMeetingIndexStore(): MeetingIndexStore {
  return new FileMeetingIndexStore();
}
