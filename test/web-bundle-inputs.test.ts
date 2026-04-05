import { describe, expect, it } from "vitest";

const { affectsWebBundle, listWebBundleInputs } = await import("../scripts/web-bundle-inputs.mjs");

describe("web bundle inputs", () => {
  it("includes transitive runtime inputs outside src/web-app", () => {
    const inputs = listWebBundleInputs();

    expect(inputs).toContain("src/app/index.ts");
    expect(inputs).toContain("src/server/client.ts");
    expect(inputs).toContain("src/web/client-state.ts");
    expect(inputs).toContain("src/web-app/App.tsx");
  });

  it("excludes cli-only files", () => {
    const inputs = listWebBundleInputs();

    expect(inputs).not.toContain("src/cli.ts");
    expect(inputs).not.toContain("src/commands/notes.ts");
    expect(inputs).not.toContain("test/web-client-state.test.ts");
  });

  it("flags transitive web dependency changes", () => {
    expect(affectsWebBundle(["src/web/client-state.ts"])).toBe(true);
    expect(affectsWebBundle(["src/server/client.ts"])).toBe(true);
    expect(affectsWebBundle(["scripts/build-web-client.mjs"])).toBe(true);
    expect(affectsWebBundle(["src/commands/notes.ts"])).toBe(false);
  });
});
