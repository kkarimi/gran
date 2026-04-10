import type { GranolaApp, GranolaAppSyncEvent } from "../app/index.ts";
import { toJson } from "../render.ts";

import { createCommandAppContext, parseSyncInterval, waitForShutdown } from "./shared.ts";
import type { CommandDefinition } from "./types.ts";
import type { ParseSpec } from "../flags.ts";

const DEFAULT_EVENTS_LIMIT = 20;
const DEFAULT_EVENTS_FOLLOW_INTERVAL_MS = 5_000;

type EventsFormat = "json" | "jsonl" | "text";

export const eventsFlags = {
  follow: { type: "boolean" },
  format: { type: "string" },
  help: { type: "boolean" },
  interval: { type: "string" },
  limit: { type: "string" },
} satisfies Record<string, ParseSpec>;

function eventsHelp(): string {
  return `Gran events

Usage:
  gran events [options]

Options:
  --format <value>    text, json, jsonl (default: text)
  --follow            Keep printing new events until interrupted
  --interval <value>  Poll interval for --follow, e.g. 5s or 1m (default: 5s)
  --limit <value>     Event count for initial output (default: 20)
  --debug             Enable debug logging
  --config <path>     Path to JSON config file
  -h, --help          Show help
`;
}

function resolveLimit(value: string | boolean | undefined): number {
  if (value === undefined) {
    return DEFAULT_EVENTS_LIMIT;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    throw new Error("invalid event limit: expected a non-negative integer");
  }

  return Number(value.trim());
}

function resolveFormat(value: string | boolean | undefined): EventsFormat {
  switch (value) {
    case undefined:
      return "text";
    case "json":
    case "jsonl":
    case "text":
      return value;
    default:
      throw new Error("invalid event format: expected text, json, or jsonl");
  }
}

function renderTextEvent(event: GranolaAppSyncEvent): string {
  return `${event.occurredAt} ${event.kind.padEnd(18)} ${event.title} (${event.meetingId})`;
}

function printEvents(
  events: GranolaAppSyncEvent[],
  format: EventsFormat,
  log: typeof console.log = console.log,
): void {
  if (format === "json") {
    log(toJson({ events }));
    return;
  }

  for (const event of events) {
    if (format === "jsonl") {
      log(JSON.stringify(event));
      continue;
    }

    log(renderTextEvent(event));
  }
}

export async function runEventsSurface(options: {
  app: Pick<GranolaApp, "listSyncEvents">;
  commandFlags: Record<string, string | boolean | undefined>;
  log?: typeof console.log;
  status?: typeof console.error;
}): Promise<number> {
  const log = options.log ?? console.log;
  const status = options.status ?? console.error;
  const format = resolveFormat(options.commandFlags.format);
  const follow = options.commandFlags.follow === true;
  const limit = resolveLimit(options.commandFlags.limit);

  if (follow && format === "json") {
    throw new Error("cannot combine --follow with --format json; use text or jsonl");
  }

  const initial = await options.app.listSyncEvents({ limit });
  if (initial.events.length === 0) {
    if (!follow && format === "text") {
      log("No events yet.");
    } else if (!follow && format === "json") {
      log(toJson({ events: [] }));
    }
  } else {
    printEvents([...initial.events].reverse(), format, log);
  }

  if (!follow) {
    return 0;
  }

  const intervalMs = parseSyncInterval(
    options.commandFlags.interval,
    DEFAULT_EVENTS_FOLLOW_INTERVAL_MS,
  );
  const seen = new Set(initial.events.map((event) => event.id));
  let timer: ReturnType<typeof setInterval> | undefined;
  let running = false;

  const flush = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await options.app.listSyncEvents({ limit });
      const nextEvents = [...result.events].reverse().filter((event) => !seen.has(event.id));
      if (nextEvents.length > 0) {
        printEvents(nextEvents, format, log);
        for (const event of nextEvents) {
          seen.add(event.id);
        }
      }
    } finally {
      running = false;
    }
  };

  status(`Following Gran events every ${intervalMs}ms. Press Ctrl+C to stop.`);
  timer = setInterval(() => {
    void flush();
  }, intervalMs);

  await waitForShutdown(async () => {
    if (timer) {
      clearInterval(timer);
    }
  });

  return 0;
}

export const eventsCommand: CommandDefinition = {
  description: "Inspect and follow the local Gran event stream",
  flags: eventsFlags,
  help: eventsHelp,
  name: "events",
  async run({ commandFlags, globalFlags }) {
    const { app } = await createCommandAppContext(commandFlags, globalFlags);
    return await runEventsSurface({
      app,
      commandFlags,
    });
  },
};
