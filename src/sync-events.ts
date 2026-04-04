import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { GranolaAppSyncEvent } from "./app/types.ts";
import { defaultGranolaToolkitPersistenceLayout } from "./persistence/layout.ts";
import { parseJsonString } from "./utils.ts";

function cloneSyncEvent(event: GranolaAppSyncEvent): GranolaAppSyncEvent {
  return { ...event };
}

export interface SyncEventStore {
  appendEvents(events: GranolaAppSyncEvent[]): Promise<void>;
  readEvents(limit?: number): Promise<GranolaAppSyncEvent[]>;
}

export class MemorySyncEventStore implements SyncEventStore {
  #events: GranolaAppSyncEvent[] = [];

  async appendEvents(events: GranolaAppSyncEvent[]): Promise<void> {
    this.#events.push(...events.map(cloneSyncEvent));
  }

  async readEvents(limit = 50): Promise<GranolaAppSyncEvent[]> {
    return this.#events.slice(-limit).reverse().map(cloneSyncEvent);
  }
}

export class FileSyncEventStore implements SyncEventStore {
  constructor(private readonly filePath: string = defaultSyncEventsFilePath()) {}

  async appendEvents(events: GranolaAppSyncEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await mkdir(dirname(this.filePath), { recursive: true });
    const payload = events.map((event) => JSON.stringify(event)).join("\n");
    await appendFile(this.filePath, `${payload}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  async readEvents(limit = 50): Promise<GranolaAppSyncEvent[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      const events = contents
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => parseJsonString<GranolaAppSyncEvent>(line))
        .filter((event): event is GranolaAppSyncEvent => Boolean(event))
        .map(cloneSyncEvent);

      return events.slice(-limit).reverse();
    } catch {
      return [];
    }
  }
}

export function defaultSyncEventsFilePath(): string {
  return defaultGranolaToolkitPersistenceLayout().syncEventsFile;
}

export function createDefaultSyncEventStore(): SyncEventStore {
  return new FileSyncEventStore();
}
