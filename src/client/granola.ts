import type { GranolaDocument, GranolaFolder } from "../types.ts";

import { parseDocument, parseFolder } from "./parsers.ts";
import type { AuthenticatedHttpClient } from "./http.ts";

const DEFAULT_CLIENT_VERSION = "5.354.0";
const DOCUMENTS_URL = "https://api.granola.ai/v2/get-documents";
const FOLDERS_URLS = [
  "https://api.granola.ai/v2/get-document-lists",
  "https://api.granola.ai/v1/get-document-lists",
] as const;

function resolveClientVersion(value?: string): string {
  return value?.trim() || process.env.GRANOLA_CLIENT_VERSION?.trim() || DEFAULT_CLIENT_VERSION;
}

export class GranolaApiClient {
  private readonly clientVersion: string;
  private readonly documentsUrl: string;

  constructor(
    private readonly httpClient: AuthenticatedHttpClient,
    options: string | { clientVersion?: string; documentsUrl?: string } = DOCUMENTS_URL,
  ) {
    if (typeof options === "string") {
      this.documentsUrl = options;
      this.clientVersion = resolveClientVersion();
      return;
    }

    this.documentsUrl = options.documentsUrl ?? DOCUMENTS_URL;
    this.clientVersion = resolveClientVersion(options.clientVersion);
  }

  async listDocuments(options: { limit?: number; timeoutMs: number }): Promise<GranolaDocument[]> {
    const documents: GranolaDocument[] = [];
    const limit = options.limit ?? 100;
    let offset = 0;

    for (;;) {
      const response = await this.httpClient.postJson(
        this.documentsUrl,
        {
          include_last_viewed_panel: true,
          limit,
          offset,
        },
        {
          headers: {
            "User-Agent": `Granola/${this.clientVersion}`,
            "X-Client-Version": this.clientVersion,
          },
          timeoutMs: options.timeoutMs,
        },
      );

      if (!response.ok) {
        const body = (await response.text()).slice(0, 500);
        throw new Error(
          `failed to get documents: ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`,
        );
      }

      const payload = (await response.json()) as { docs?: unknown[] };
      if (!Array.isArray(payload.docs)) {
        throw new Error("failed to parse documents response");
      }

      const page = payload.docs.map(parseDocument);
      documents.push(...page);

      if (page.length < limit) {
        break;
      }

      offset += limit;
    }

    return documents;
  }

  async listFolders(options: { timeoutMs: number }): Promise<GranolaFolder[]> {
    let lastError: Error | undefined;

    for (const foldersUrl of FOLDERS_URLS) {
      const response = await this.httpClient.postJson(
        foldersUrl,
        {},
        {
          headers: {
            "User-Agent": `Granola/${this.clientVersion}`,
            "X-Client-Version": this.clientVersion,
          },
          timeoutMs: options.timeoutMs,
        },
      );

      if (response.status === 404) {
        lastError = new Error(`failed to get folders: ${response.status} ${response.statusText}`);
        continue;
      }

      if (!response.ok) {
        const body = (await response.text()).slice(0, 500);
        throw new Error(
          `failed to get folders: ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`,
        );
      }

      const payload = (await response.json()) as unknown;
      const folders = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { lists?: unknown[] }).lists)
          ? (payload as { lists: unknown[] }).lists
          : Array.isArray((payload as { document_lists?: unknown[] }).document_lists)
            ? (payload as { document_lists: unknown[] }).document_lists
            : [];

      return folders.map(parseFolder);
    }

    throw lastError ?? new Error("failed to get folders");
  }
}
