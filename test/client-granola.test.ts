import { describe, expect, test } from "vite-plus/test";

import { CachedTokenProvider } from "../src/client/auth.ts";
import { GranolaApiClient } from "../src/client/granola.ts";
import { AuthenticatedHttpClient } from "../src/client/http.ts";

describe("GranolaApiClient", () => {
  test("sends the configured client version headers", async () => {
    const client = new GranolaApiClient(
      new AuthenticatedHttpClient({
        fetchImpl: async (_url, init) => {
          const headers = new Headers(init?.headers);

          expect(headers.get("user-agent")).toBe("Granola/9.9.9");
          expect(headers.get("x-client-version")).toBe("9.9.9");

          return new Response(JSON.stringify({ docs: [] }), { status: 200 });
        },
        tokenProvider: new CachedTokenProvider({
          async loadAccessToken() {
            return "token-1";
          },
        }),
      }),
      {
        clientVersion: "9.9.9",
        documentsUrl: "https://example.test/documents",
      },
    );

    const documents = await client.listDocuments({ timeoutMs: 5_000 });

    expect(documents).toEqual([]);
  });
});
