import { readFileSync } from "node:fs";

import { describe, expect, test } from "vite-plus/test";

import { generatedModule } from "../scripts/build-web-client.mjs";

describe("web bundle generation", () => {
  test("preserves template literals in browser assets", () => {
    const js = "const message = `Hello ${name}`;\nconsole.log(message);\n";
    const css = ".shell { display: grid; }\n";

    const generated = generatedModule({ css, js });

    expect(generated).not.toContain("String.raw");
    expect(generated).toContain(JSON.stringify(js));
    expect(generated).toContain(JSON.stringify(css));
  });

  test("pins the generated bundle to deterministic build settings", () => {
    const script = readFileSync(
      new URL("../scripts/build-web-client.mjs", import.meta.url),
      "utf8",
    );

    expect(script).toContain('mode: "production"');
    expect(script).toContain("const isEntrypoint = entryFile === fileURLToPath(import.meta.url);");
    expect(script).toContain("process.argv.splice(checkModeIndex, 1);");
  });
});
