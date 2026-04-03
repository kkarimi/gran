import type { AccessTokenProvider } from "./auth.ts";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type SleepLike = (delayMs: number) => Promise<void>;

export interface HttpRequestOptions {
  body?: RequestInit["body"];
  headers?: Record<string, string>;
  method?: string;
  retryOnUnauthorized?: boolean;
  timeoutMs: number;
  url: string;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue?.trim()) {
    return undefined;
  }

  if (/^\d+$/.test(headerValue.trim())) {
    return Number(headerValue.trim()) * 1000;
  }

  const retryAt = Date.parse(headerValue);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(0, retryAt - Date.now());
}

export class AuthenticatedHttpClient {
  private readonly fetchImpl: FetchLike;

  constructor(options: {
    fetchImpl?: FetchLike;
    logger?: Pick<Console, "warn">;
    maxRetries?: number;
    retryBaseDelayMs?: number;
    retryMaxDelayMs?: number;
    sleepImpl?: SleepLike;
    tokenProvider: AccessTokenProvider;
  }) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
    this.retryMaxDelayMs = options.retryMaxDelayMs ?? 5_000;
    this.sleepImpl = options.sleepImpl ?? sleep;
    this.tokenProvider = options.tokenProvider;
  }

  private readonly logger?: Pick<Console, "warn">;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly sleepImpl: SleepLike;
  private readonly tokenProvider: AccessTokenProvider;

  private async retry(
    options: HttpRequestOptions,
    attempt: number,
    reason: string,
    response?: Response,
  ): Promise<Response> {
    const retryAfterMs = parseRetryAfter(response?.headers.get("retry-after") ?? null);
    const delayMs = Math.min(
      retryAfterMs ?? this.retryBaseDelayMs * 2 ** attempt,
      this.retryMaxDelayMs,
    );

    this.logger?.warn?.(`${reason}; retrying in ${delayMs}ms (${attempt + 1}/${this.maxRetries})`);
    await this.sleepImpl(delayMs);
    return this.request(options, attempt + 1);
  }

  async request(options: HttpRequestOptions, attempt = 0): Promise<Response> {
    const { retryOnUnauthorized = true, timeoutMs, url } = options;
    const accessToken = await this.tokenProvider.getAccessToken();
    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        body: options.body,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
        },
        method: options.method ?? "GET",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt < this.maxRetries) {
        const message = error instanceof Error ? error.message : String(error);
        return this.retry(options, attempt, `request failed: ${message}`);
      }

      throw error;
    }

    if (response.status === 401 && retryOnUnauthorized) {
      this.logger?.warn?.("request returned 401; invalidating token provider and retrying once");
      await this.tokenProvider.invalidate();
      return this.request(
        {
          ...options,
          retryOnUnauthorized: false,
        },
        attempt,
      );
    }

    if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
      return this.retry(
        options,
        attempt,
        `request returned ${response.status} ${response.statusText || ""}`.trim(),
        response,
      );
    }

    return response;
  }

  async postJson(
    url: string,
    body: unknown,
    options: Omit<HttpRequestOptions, "body" | "method" | "url"> = { timeoutMs: 30_000 },
  ): Promise<Response> {
    return this.request({
      ...options,
      body: JSON.stringify(body),
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        ...options.headers,
      },
      method: "POST",
      url,
    });
  }
}
