import { describe, expect, test } from "vite-plus/test";

import { CachedTokenProvider, type AccessTokenSource } from "../src/client/auth.ts";
import { AuthenticatedHttpClient, type FetchLike } from "../src/client/http.ts";

describe("AuthenticatedHttpClient", () => {
  test("retries once after a 401 by invalidating the token provider", async () => {
    let currentToken = "token-1";
    let requests = 0;

    const source: AccessTokenSource = {
      async loadAccessToken() {
        return currentToken;
      },
    };

    const tokenProvider = new CachedTokenProvider(source);
    const fetchImpl: FetchLike = async (_url, init) => {
      requests += 1;

      const authorization = new Headers(init?.headers).get("authorization");
      if (requests === 1) {
        expect(authorization).toBe("Bearer token-1");
        currentToken = "token-2";
        return new Response("unauthorised", { status: 401, statusText: "Unauthorized" });
      }

      expect(authorization).toBe("Bearer token-2");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const client = new AuthenticatedHttpClient({
      fetchImpl,
      tokenProvider,
    });

    const response = await client.request({
      timeoutMs: 5_000,
      url: "https://example.test",
    });

    expect(response.status).toBe(200);
    expect(requests).toBe(2);
  });

  test("retries transient status codes with backoff", async () => {
    let requests = 0;
    const sleeps: number[] = [];

    const source: AccessTokenSource = {
      async loadAccessToken() {
        return "token-1";
      },
    };

    const client = new AuthenticatedHttpClient({
      fetchImpl: async () => {
        requests += 1;

        if (requests === 1) {
          return new Response("retry later", {
            headers: {
              "retry-after": "1",
            },
            status: 429,
            statusText: "Too Many Requests",
          });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      retryBaseDelayMs: 25,
      sleepImpl: async (delayMs) => {
        sleeps.push(delayMs);
      },
      tokenProvider: new CachedTokenProvider(source),
    });

    const response = await client.request({
      timeoutMs: 5_000,
      url: "https://example.test",
    });

    expect(response.status).toBe(200);
    expect(requests).toBe(2);
    expect(sleeps).toEqual([1000]);
  });

  test("retries fetch failures before surfacing the response", async () => {
    let requests = 0;
    const sleeps: number[] = [];

    const client = new AuthenticatedHttpClient({
      fetchImpl: async () => {
        requests += 1;
        if (requests === 1) {
          throw new Error("temporary network issue");
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      retryBaseDelayMs: 50,
      sleepImpl: async (delayMs) => {
        sleeps.push(delayMs);
      },
      tokenProvider: new CachedTokenProvider({
        async loadAccessToken() {
          return "token-1";
        },
      }),
    });

    const response = await client.request({
      timeoutMs: 5_000,
      url: "https://example.test",
    });

    expect(response.status).toBe(200);
    expect(requests).toBe(2);
    expect(sleeps).toEqual([50]);
  });
});
