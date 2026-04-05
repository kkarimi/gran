import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

import { CachedTokenProvider } from "./client/auth.ts";
import { AuthenticatedHttpClient, type FetchLike } from "./client/http.ts";
import type { AppConfig, GranolaAgentProviderKind } from "./types.ts";

const DEFAULT_CODEX_MODEL = "gpt-5-codex";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-5-mini";
const OPENROUTER_REFERER = "https://github.com/kkarimi/granola-toolkit";
const OPENROUTER_TITLE = "granola-toolkit";

export interface GranolaAutomationAgentRequest {
  cwd?: string;
  dryRun?: boolean;
  model?: string;
  prompt: string;
  provider?: GranolaAgentProviderKind;
  retries?: number;
  systemPrompt?: string;
  timeoutMs?: number;
}

export interface GranolaAutomationAgentResult {
  command?: string;
  dryRun: boolean;
  model: string;
  output?: string;
  prompt: string;
  provider: GranolaAgentProviderKind;
  systemPrompt?: string;
}

export interface GranolaAutomationAgentRunner {
  run(request: GranolaAutomationAgentRequest): Promise<GranolaAutomationAgentResult>;
}

export interface CodexCommandRequest {
  command: string;
  cwd?: string;
  model?: string;
  prompt: string;
  timeoutMs: number;
}

export interface CodexCommandResult {
  command: string;
  output?: string;
}

function trimString(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

function resolveProvider(
  request: GranolaAutomationAgentRequest,
  config: AppConfig,
  env: NodeJS.ProcessEnv,
): GranolaAgentProviderKind {
  if (request.provider) {
    return request.provider;
  }

  if (config.agents?.defaultProvider) {
    return config.agents.defaultProvider;
  }

  if (trimString(env.OPENROUTER_API_KEY) || trimString(env.GRANOLA_OPENROUTER_API_KEY)) {
    return "openrouter";
  }

  if (trimString(env.OPENAI_API_KEY) || trimString(env.GRANOLA_OPENAI_API_KEY)) {
    return "openai";
  }

  return "codex";
}

function resolveModel(
  provider: GranolaAgentProviderKind,
  request: GranolaAutomationAgentRequest,
  config: AppConfig,
): string {
  return (
    trimString(request.model) ??
    trimString(config.agents?.defaultModel) ??
    (provider === "openrouter"
      ? DEFAULT_OPENROUTER_MODEL
      : provider === "openai"
        ? DEFAULT_OPENAI_MODEL
        : DEFAULT_CODEX_MODEL)
  );
}

function resolveTimeoutMs(request: GranolaAutomationAgentRequest, config: AppConfig): number {
  return request.timeoutMs ?? config.agents?.timeoutMs ?? 300_000;
}

function resolveRetries(request: GranolaAutomationAgentRequest, config: AppConfig): number {
  return request.retries ?? config.agents?.maxRetries ?? 2;
}

function resolveDryRun(request: GranolaAutomationAgentRequest, config: AppConfig): boolean {
  return request.dryRun ?? config.agents?.dryRun ?? false;
}

function openaiApiKey(env: NodeJS.ProcessEnv): string | undefined {
  return trimString(env.OPENAI_API_KEY) ?? trimString(env.GRANOLA_OPENAI_API_KEY);
}

function openrouterApiKey(env: NodeJS.ProcessEnv): string | undefined {
  return trimString(env.OPENROUTER_API_KEY) ?? trimString(env.GRANOLA_OPENROUTER_API_KEY);
}

async function responseError(response: Response, label: string): Promise<Error> {
  let details = `${response.status} ${response.statusText}`.trim();

  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown } | string;
      message?: unknown;
    };
    if (typeof payload.error === "string" && payload.error.trim()) {
      details = payload.error;
    } else if (
      payload.error &&
      typeof payload.error === "object" &&
      typeof payload.error.message === "string" &&
      payload.error.message.trim()
    ) {
      details = payload.error.message;
    } else if (typeof payload.message === "string" && payload.message.trim()) {
      details = payload.message;
    }
  } catch {
    const text = (await response.text()).trim();
    if (text) {
      details = text;
    }
  }

  return new Error(`${label}: ${details}`);
}

function messageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

async function runCodexCliCommand(request: CodexCommandRequest): Promise<CodexCommandResult> {
  const tempDirectory = await mkdtemp(join(tmpdir(), "granola-toolkit-codex-"));
  const outputFile = join(tempDirectory, "last-message.txt");
  const args = ["exec", "--skip-git-repo-check", "--color", "never"];
  if (request.cwd) {
    args.push("-C", request.cwd);
  }
  if (request.model) {
    args.push("-m", request.model);
  }
  args.push("--output-last-message", outputFile, "-");

  const commandText = [request.command, ...args].join(" ");

  try {
    const output = await new Promise<string | undefined>((resolve, reject) => {
      const child = spawn(request.command, args, {
        cwd: request.cwd ? resolvePath(request.cwd) : process.cwd(),
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, request.timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      child.stderr.on("data", (chunk) => {
        stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", async (code) => {
        clearTimeout(timeout);
        const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        if (timedOut) {
          reject(new Error(`codex provider timed out after ${request.timeoutMs}ms`));
          return;
        }

        if (code !== 0) {
          reject(new Error(stderr || stdout || `codex exited with status ${String(code)}`));
          return;
        }

        try {
          const fileOutput = (await readFile(outputFile, "utf8")).trim();
          resolve(fileOutput || stdout || undefined);
        } catch {
          resolve(stdout || undefined);
        }
      });

      child.stdin.write(request.prompt);
      child.stdin.end();
    });

    return {
      command: commandText,
      output,
    };
  } finally {
    await rm(tempDirectory, { force: true, recursive: true }).catch(() => undefined);
  }
}

async function runOpenAiCompatibleRequest(options: {
  baseUrl: string;
  fetchImpl?: FetchLike;
  headers?: Record<string, string>;
  label: string;
  maxRetries: number;
  model: string;
  prompt: string;
  systemPrompt?: string;
  timeoutMs: number;
  token: string;
}): Promise<string | undefined> {
  const client = new AuthenticatedHttpClient({
    fetchImpl: options.fetchImpl,
    maxRetries: options.maxRetries,
    tokenProvider: new CachedTokenProvider({
      async loadAccessToken() {
        return options.token;
      },
    }),
  });

  const response = await client.postJson(
    `${options.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      messages: [
        ...(options.systemPrompt
          ? [
              {
                content: options.systemPrompt,
                role: "system",
              },
            ]
          : []),
        {
          content: options.prompt,
          role: "user",
        },
      ],
      model: options.model,
    },
    {
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
      timeoutMs: options.timeoutMs,
    },
  );

  if (!response.ok) {
    throw await responseError(response, options.label);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  return messageText(content) || undefined;
}

export function createDefaultAutomationAgentRunner(
  config: AppConfig,
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: FetchLike;
    runCodexCommand?: (request: CodexCommandRequest) => Promise<CodexCommandResult>;
  } = {},
): GranolaAutomationAgentRunner {
  const env = options.env ?? process.env;
  const runCodexCommand = options.runCodexCommand ?? runCodexCliCommand;

  return {
    async run(request) {
      const provider = resolveProvider(request, config, env);
      const model = resolveModel(provider, request, config);
      const timeoutMs = resolveTimeoutMs(request, config);
      const retries = resolveRetries(request, config);
      const dryRun = resolveDryRun(request, config);

      if (dryRun) {
        return {
          dryRun,
          model,
          output: undefined,
          prompt: request.prompt,
          provider,
          systemPrompt: request.systemPrompt,
        };
      }

      if (provider === "codex") {
        const result = await runCodexCommand({
          command: config.agents?.codexCommand ?? "codex",
          cwd: request.cwd,
          model,
          prompt: request.systemPrompt
            ? `${request.systemPrompt.trim()}\n\n${request.prompt}`
            : request.prompt,
          timeoutMs,
        });
        return {
          command: result.command,
          dryRun,
          model,
          output: result.output,
          prompt: request.prompt,
          provider,
          systemPrompt: request.systemPrompt,
        };
      }

      const token = provider === "openrouter" ? openrouterApiKey(env) : openaiApiKey(env);
      if (!token) {
        throw new Error(
          provider === "openrouter"
            ? "OpenRouter API key not found. Set OPENROUTER_API_KEY or GRANOLA_OPENROUTER_API_KEY."
            : "OpenAI API key not found. Set OPENAI_API_KEY or GRANOLA_OPENAI_API_KEY.",
        );
      }

      return {
        dryRun,
        model,
        output: await runOpenAiCompatibleRequest({
          baseUrl:
            provider === "openrouter"
              ? (config.agents?.openrouterBaseUrl ?? "https://openrouter.ai/api/v1")
              : (config.agents?.openaiBaseUrl ?? "https://api.openai.com/v1"),
          fetchImpl: options.fetchImpl,
          headers:
            provider === "openrouter"
              ? {
                  "HTTP-Referer": OPENROUTER_REFERER,
                  "X-Title": OPENROUTER_TITLE,
                }
              : undefined,
          label: provider === "openrouter" ? "OpenRouter request failed" : "OpenAI request failed",
          maxRetries: retries,
          model,
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          timeoutMs,
          token,
        }),
        prompt: request.prompt,
        provider,
        systemPrompt: request.systemPrompt,
      };
    },
  };
}
