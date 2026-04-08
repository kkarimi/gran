import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  connectGranService,
  createGranExportTarget,
  createGranSdk,
  exportGranArchive,
  loadGranConfig,
  type GranolaAppApi,
} from "../src/index.ts";

describe("gran-sdk", () => {
  test("loads JSON config through the SDK helper", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gran-sdk-config-"));
    const configPath = join(directory, ".gran.json");

    await writeFile(
      configPath,
      JSON.stringify(
        {
          "agent-provider": "openrouter",
          output: "./notes-out",
          "transcript-output": "./transcripts-out",
        },
        null,
        2,
      ),
      "utf8",
    );

    const config = await loadGranConfig({ config: configPath });

    expect(config.configFileUsed).toBe(configPath);
    expect(config.agents?.defaultProvider).toBe("openrouter");
    expect(config.notes.output).toBe(join(directory, "notes-out"));
  });

  test("creates an app context with inline sdk options", async () => {
    const { app, config } = await createGranSdk({
      apiKey: "grn_test_sdk_key",
    });

    expect(config.apiKey).toBe("grn_test_sdk_key");
    expect(app.getState().auth.apiKeyAvailable).toBe(true);
    expect(typeof app.listMeetings).toBe("function");
  });

  test("creates export targets with sensible defaults", () => {
    const target = createGranExportTarget("obsidian-vault", {
      dailyNotesDir: "Daily",
      id: "vault",
      outputDir: "/tmp/vault",
    });

    expect(target).toEqual({
      dailyNotesDir: "Daily",
      id: "vault",
      kind: "obsidian-vault",
      name: undefined,
      notesFormat: "markdown",
      notesSubdir: "Meetings",
      outputDir: "/tmp/vault",
      transcriptsFormat: "markdown",
      transcriptsSubdir: "Meeting Transcripts",
    });
  });

  test("exports notes and transcripts together with one helper", async () => {
    const calls: Array<{ kind: "notes" | "transcripts"; options: Record<string, unknown> }> = [];
    const app = {
      async exportNotes(format = "markdown", options = {}) {
        calls.push({ kind: "notes", options: { format, ...options } });
        return {
          documentCount: 1,
          documents: [],
          format,
          job: {
            completedCount: 1,
            format,
            id: "job-notes-1",
            itemCount: 1,
            kind: "notes",
            outputDir: String((options as { outputDir?: string }).outputDir ?? ""),
            scope: { folderId: "fol_personal", folderName: "Personal", mode: "folder" as const },
            startedAt: "2026-04-08T10:00:00.000Z",
            status: "completed" as const,
            written: 1,
          },
          outputDir: String((options as { outputDir?: string }).outputDir ?? ""),
          scope: { folderId: "fol_personal", folderName: "Personal", mode: "folder" as const },
          written: 1,
        };
      },
      async exportTranscripts(format = "text", options = {}) {
        calls.push({ kind: "transcripts", options: { format, ...options } });
        return {
          cacheData: {
            documents: {},
            transcripts: {},
          },
          format,
          job: {
            completedCount: 1,
            format,
            id: "job-transcripts-1",
            itemCount: 1,
            kind: "transcripts",
            outputDir: String((options as { outputDir?: string }).outputDir ?? ""),
            scope: { folderId: "fol_personal", folderName: "Personal", mode: "folder" as const },
            startedAt: "2026-04-08T10:00:00.000Z",
            status: "completed" as const,
            written: 1,
          },
          outputDir: String((options as { outputDir?: string }).outputDir ?? ""),
          scope: { folderId: "fol_personal", folderName: "Personal", mode: "folder" as const },
          transcriptCount: 1,
          written: 1,
        };
      },
      async findFolder(query: string) {
        expect(query).toBe("Personal");
        return {
          createdAt: "2026-04-08T09:00:00.000Z",
          documentCount: 1,
          documentIds: ["not_personal_1"],
          id: "fol_personal",
          isFavourite: false,
          meetings: [],
          name: "Personal",
          updatedAt: "2026-04-08T09:00:00.000Z",
          workspaceId: "workspace_1",
        };
      },
    } satisfies Pick<GranolaAppApi, "exportNotes" | "exportTranscripts" | "findFolder">;

    const result = await exportGranArchive(app, {
      folder: "Personal",
      outputRoot: "/tmp/archive",
    });

    expect(result.folder?.id).toBe("fol_personal");
    expect(result.notes?.outputDir).toBe("/tmp/archive/notes");
    expect(result.transcripts?.outputDir).toBe("/tmp/archive/transcripts");
    expect(calls).toEqual([
      {
        kind: "notes",
        options: {
          folderId: "fol_personal",
          format: "markdown",
          outputDir: "/tmp/archive/notes",
          scopedOutput: false,
          targetId: undefined,
        },
      },
      {
        kind: "transcripts",
        options: {
          folderId: "fol_personal",
          format: "text",
          outputDir: "/tmp/archive/transcripts",
          scopedOutput: false,
          targetId: undefined,
        },
      },
    ]);
  });

  test("connects to a local Gran service client", async () => {
    const fetchCalls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const inputUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(inputUrl);
      fetchCalls.push(url.pathname);

      switch (url.pathname) {
        case "/server/info":
          return new Response(
            JSON.stringify({
              build: {
                packageName: "@kkarimi/gran",
                version: "0.67.0",
              },
              config: {},
              capabilities: {
                attach: true,
                auth: true,
                automation: true,
                events: true,
                exports: true,
                folders: true,
                meetingOpen: true,
                plugins: true,
                processing: true,
                sync: true,
                webClient: true,
              },
              persistence: {
                exportJobs: true,
                meetingIndex: true,
                sessionStore: "keychain",
                syncEvents: true,
                syncState: true,
              },
              product: "gran",
              protocolVersion: 4,
              runtime: {
                mode: "background-service",
                startedAt: "2026-04-08T10:00:00.000Z",
                syncEnabled: true,
              },
              transport: "local-http",
            }),
            { headers: { "content-type": "application/json" } },
          );
        case "/state":
          return new Response(
            JSON.stringify({
              auth: {
                apiKeyAvailable: true,
                mode: "api-key",
                refreshAvailable: false,
                storedSessionAvailable: false,
                supabaseAvailable: false,
              },
              automation: {
                actionRunCount: 0,
                artefactCount: 0,
                enabled: false,
                issueCount: 0,
                lastRuns: [],
                matchCount: 0,
                pluginEnabled: false,
                ruleCount: 0,
              },
              cache: {
                configured: false,
                documentCount: 0,
                loaded: false,
                transcriptCount: 0,
              },
              config: {
                debug: false,
                notes: {
                  output: "/tmp/notes",
                  timeoutMs: 120000,
                },
                transcripts: {
                  cacheFile: "",
                  output: "/tmp/transcripts",
                },
              },
              documents: {
                count: 12,
                loaded: true,
              },
              exports: {
                jobs: [],
              },
              folders: {
                count: 3,
                loaded: true,
              },
              index: {
                available: true,
                loaded: true,
                meetingCount: 12,
              },
              plugins: {
                items: [],
              },
              sync: {
                eventCount: 0,
                lastChanges: [],
                running: false,
              },
              ui: {
                surface: "server",
              },
            }),
            { headers: { "content-type": "application/json" } },
          );
        case "/events":
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.close();
              },
            }),
            {
              headers: { "content-type": "text/event-stream" },
            },
          );
        default:
          return new Response("not found", { status: 404 });
      }
    };

    const client = await connectGranService("http://127.0.0.1:4110", {
      fetchImpl,
      reconnectDelayMs: 0,
    });

    expect(client.info.product).toBe("gran");
    expect(client.getState().index.meetingCount).toBe(12);
    expect(fetchCalls).toContain("/server/info");
    expect(fetchCalls).toContain("/state");

    await client.close();
  });
});
