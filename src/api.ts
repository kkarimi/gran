import type { GranolaDocument, LastViewedPanel, ProseMirrorDoc } from "./types.ts";
import { asRecord, parseJsonString, stringArray, stringValue } from "./utils.ts";

const USER_AGENT = "Granola/5.354.0";
const CLIENT_VERSION = "5.354.0";
const DOCUMENTS_URL = "https://api.granola.ai/v2/get-documents";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function parseProseMirrorDoc(
  value: unknown,
  options: { skipHtmlStrings?: boolean } = {},
): ProseMirrorDoc | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (options.skipHtmlStrings && trimmed.startsWith("<")) {
      return undefined;
    }

    const parsed = parseJsonString<unknown>(trimmed);
    if (!parsed) {
      return undefined;
    }

    return parseProseMirrorDoc(parsed, options);
  }

  const record = asRecord(value);
  if (!record || record.type !== "doc") {
    return undefined;
  }

  return record as unknown as ProseMirrorDoc;
}

function parseLastViewedPanel(value: unknown): LastViewedPanel | undefined {
  const panel = asRecord(value);
  if (!panel) {
    return undefined;
  }

  return {
    affinityNoteId: stringValue(panel.affinity_note_id),
    content: parseProseMirrorDoc(panel.content, { skipHtmlStrings: true }),
    contentUpdatedAt: stringValue(panel.content_updated_at),
    createdAt: stringValue(panel.created_at),
    deletedAt: stringValue(panel.deleted_at),
    documentId: stringValue(panel.document_id),
    generatedLines: Array.isArray(panel.generated_lines) ? panel.generated_lines : [],
    id: stringValue(panel.id),
    lastViewedAt: stringValue(panel.last_viewed_at),
    originalContent: stringValue(panel.original_content),
    suggestedQuestions: panel.suggested_questions,
    templateSlug: stringValue(panel.template_slug),
    title: stringValue(panel.title),
    updatedAt: stringValue(panel.updated_at),
  };
}

export function getAccessToken(supabaseContents: string): string {
  const wrapper = parseJsonString<Record<string, unknown>>(supabaseContents);
  if (!wrapper) {
    throw new Error("failed to parse supabase.json");
  }

  const workosTokens = wrapper.workos_tokens;
  let tokenPayload: Record<string, unknown> | undefined;

  if (typeof workosTokens === "string") {
    tokenPayload = parseJsonString<Record<string, unknown>>(workosTokens);
  } else {
    tokenPayload = asRecord(workosTokens);
  }

  const accessToken = tokenPayload ? stringValue(tokenPayload.access_token) : "";
  if (!accessToken.trim()) {
    throw new Error("access token not found in supabase.json");
  }

  return accessToken;
}

export function parseDocument(value: unknown): GranolaDocument {
  const record = asRecord(value);
  if (!record) {
    throw new Error("document payload is not an object");
  }

  return {
    content: stringValue(record.content),
    createdAt: stringValue(record.created_at),
    id: stringValue(record.id),
    lastViewedPanel: parseLastViewedPanel(record.last_viewed_panel),
    notes: parseProseMirrorDoc(record.notes),
    notesPlain: stringValue(record.notes_plain),
    tags: stringArray(record.tags),
    title: stringValue(record.title),
    updatedAt: stringValue(record.updated_at),
  };
}

export async function fetchDocuments(options: {
  fetchImpl?: FetchLike;
  logger?: Pick<Console, "error" | "warn">;
  supabaseContents: string;
  timeoutMs: number;
  url?: string;
}): Promise<GranolaDocument[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = getAccessToken(options.supabaseContents);
  const documents: GranolaDocument[] = [];

  const url = options.url ?? DOCUMENTS_URL;
  const limit = 100;
  let offset = 0;

  for (;;) {
    const signal = AbortSignal.timeout(options.timeoutMs);
    const response = await fetchImpl(url, {
      body: JSON.stringify({
        include_last_viewed_panel: true,
        limit,
        offset,
      }),
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-Client-Version": CLIENT_VERSION,
      },
      method: "POST",
      signal,
    });

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
