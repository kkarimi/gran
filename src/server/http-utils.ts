import type { IncomingMessage, ServerResponse } from "node:http";

import type { GranolaApp } from "../app/core.ts";
import type {
  GranolaAgentHarness,
  GranolaAutomationActionRunStatus,
  GranolaAutomationArtefactKind,
  GranolaAutomationArtefactStatus,
  GranolaAutomationEvaluationCase,
  GranolaAppAuthMode,
  GranolaAppStateEvent,
  GranolaMeetingSort,
  GranolaProcessingIssueSeverity,
  NoteOutputFormat,
  TranscriptOutputFormat,
} from "../app/index.ts";
import type { GranolaServerInfo } from "../transport.ts";
import type { GranolaAgentProviderKind } from "../types.ts";

export interface JsonResponseInit {
  headers?: Record<string, string>;
  status?: number;
}

export interface GranolaServerRouteContext {
  app: GranolaApp;
  enableWebClient: boolean;
  method: string;
  originHeaders: Record<string, string>;
  path: string;
  request: IncomingMessage;
  response: ServerResponse;
  securityPassword?: string;
  serverInfo: GranolaServerInfo;
  url: URL;
}

export type GranolaServerRouteHandler = (context: GranolaServerRouteContext) => Promise<boolean>;

export const PASSWORD_COOKIE_NAME = "granola_toolkit_password";

export function parseInteger(value: string | null): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("invalid limit: expected a positive integer");
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("invalid limit: expected a positive integer");
  }

  return parsed;
}

export function parseMeetingSort(value: string | null): GranolaMeetingSort | undefined {
  switch (value) {
    case null:
    case "":
      return undefined;
    case "title-asc":
    case "title-desc":
    case "updated-asc":
    case "updated-desc":
      return value;
    default:
      throw new Error("invalid sort: expected updated-desc, updated-asc, title-asc, or title-desc");
  }
}

export function parseAuthMode(value: unknown): GranolaAppAuthMode {
  switch (value) {
    case "api-key":
    case "stored-session":
    case "supabase-file":
      return value;
    default:
      throw new Error("invalid auth mode: expected api-key, stored-session, or supabase-file");
  }
}

export function parseAutomationRunStatus(
  value: string | null,
): GranolaAutomationActionRunStatus | undefined {
  switch (value) {
    case null:
    case "":
      return undefined;
    case "completed":
    case "failed":
    case "pending":
    case "skipped":
      return value;
    default:
      throw new Error("invalid automation status: expected completed, failed, pending, or skipped");
  }
}

export function parseAutomationArtefactKind(
  value: string | null,
): GranolaAutomationArtefactKind | undefined {
  switch (value) {
    case null:
    case "":
      return undefined;
    case "enrichment":
    case "notes":
      return value;
    default:
      throw new Error("invalid automation artefact kind: expected enrichment or notes");
  }
}

export function parseAutomationArtefactStatus(
  value: string | null,
): GranolaAutomationArtefactStatus | undefined {
  switch (value) {
    case null:
    case "":
      return undefined;
    case "approved":
    case "generated":
    case "rejected":
    case "superseded":
      return value;
    default:
      throw new Error(
        "invalid automation artefact status: expected approved, generated, rejected, or superseded",
      );
  }
}

export function parseProcessingIssueSeverity(
  value: string | null,
): GranolaProcessingIssueSeverity | undefined {
  switch (value) {
    case null:
    case "":
      return undefined;
    case "error":
    case "warning":
      return value;
    default:
      throw new Error("invalid processing severity: expected error or warning");
  }
}

export function parseAgentProviderKind(value: unknown): GranolaAgentProviderKind | undefined {
  switch (value) {
    case undefined:
    case null:
    case "":
      return undefined;
    case "codex":
    case "openai":
    case "openrouter":
      return value;
    default:
      throw new Error("invalid provider: expected codex, openai, or openrouter");
  }
}

export function harnessesFromBody(value: unknown): GranolaAgentHarness[] {
  if (!Array.isArray(value)) {
    throw new Error("harnesses must be an array");
  }

  return value as GranolaAgentHarness[];
}

export function rulesFromBody(value: unknown): import("../app/index.ts").GranolaAutomationRule[] {
  if (!Array.isArray(value)) {
    throw new Error("rules must be an array");
  }

  return value as import("../app/index.ts").GranolaAutomationRule[];
}

export function evaluationCasesFromBody(value: unknown): GranolaAutomationEvaluationCase[] {
  if (!Array.isArray(value)) {
    throw new Error("evaluation cases must be an array");
  }

  return value as GranolaAutomationEvaluationCase[];
}

export function stringArrayFromBody(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  return items.length > 0 ? items : undefined;
}

export function folderIdFromBody(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function sendJson(
  response: ServerResponse,
  body: unknown,
  init: JsonResponseInit = {},
): void {
  const payload = `${JSON.stringify(body, null, 2)}\n`;
  response.writeHead(init.status ?? 200, {
    "content-length": Buffer.byteLength(payload),
    "content-type": "application/json; charset=utf-8",
    ...init.headers,
  });
  response.end(payload);
}

export function sendText(
  response: ServerResponse,
  body: string,
  status = 200,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    "content-length": Buffer.byteLength(body),
    "content-type": "text/plain; charset=utf-8",
    ...headers,
  });
  response.end(body);
}

export function sendHtml(
  response: ServerResponse,
  body: string,
  status = 200,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    "content-length": Buffer.byteLength(body),
    "content-type": "text/html; charset=utf-8",
    ...headers,
  });
  response.end(body);
}

export function sendNoContent(
  response: ServerResponse,
  status = 204,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, headers);
  response.end();
}

export async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("request body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "failed to parse JSON body");
  }
}

export function formatSseEvent(event: GranolaAppStateEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function noteFormatFromBody(value: unknown): NoteOutputFormat {
  switch (value) {
    case undefined:
    case "markdown":
      return "markdown";
    case "json":
    case "raw":
    case "yaml":
      return value;
    default:
      throw new Error("invalid notes format: expected markdown, json, yaml, or raw");
  }
}

export function transcriptFormatFromBody(value: unknown): TranscriptOutputFormat {
  switch (value) {
    case undefined:
    case "text":
      return "text";
    case "json":
    case "raw":
    case "yaml":
      return value;
    default:
      throw new Error("invalid transcript format: expected text, json, yaml, or raw");
  }
}

export function parseCookies(request: IncomingMessage): Record<string, string> {
  const header = request.headers.cookie;
  if (!header) {
    return {};
  }

  const cookies: Record<string, string> = {};
  for (const chunk of header.split(";")) {
    const [name, ...valueParts] = chunk.trim().split("=");
    if (!name) {
      continue;
    }

    cookies[name] = decodeURIComponent(valueParts.join("="));
  }

  return cookies;
}

export function passwordCookieHeader(password: string): string {
  return `${PASSWORD_COOKIE_NAME}=${encodeURIComponent(password)}; HttpOnly; Path=/; SameSite=Strict`;
}

export function clearPasswordCookieHeader(): string {
  return `${PASSWORD_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`;
}
