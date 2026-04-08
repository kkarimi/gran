import { describe, expect, test } from "vite-plus/test";

import {
  detectStandaloneTarget,
  parseStandaloneTarget,
  standaloneArchiveName,
  standaloneAssetBaseName,
  standaloneExecutableName,
  standalonePackageLabel,
  supportedStandaloneTargets,
} from "../scripts/standalone-assets.mjs";

describe("standalone assets", () => {
  test("parses supported targets", () => {
    expect(parseStandaloneTarget("darwin-arm64")).toEqual({
      archiveExtension: "tar.gz",
      arch: "arm64",
      id: "darwin-arm64",
      platform: "darwin",
    });
  });

  test("detects supported host platforms", () => {
    expect(detectStandaloneTarget("linux", "x64")).toEqual(parseStandaloneTarget("linux-x64"));
    expect(detectStandaloneTarget("win32", "x64")).toEqual(parseStandaloneTarget("win32-x64"));
  });

  test("builds executable and archive names", () => {
    const darwinTarget = parseStandaloneTarget("darwin-arm64");
    const windowsTarget = parseStandaloneTarget("win32-x64");

    expect(standaloneExecutableName("gran", darwinTarget)).toBe("gran");
    expect(standaloneExecutableName("gran", windowsTarget)).toBe("gran.exe");
    expect(standalonePackageLabel("@kkarimi/gran")).toBe("gran");
    expect(standaloneAssetBaseName("@kkarimi/gran", "0.44.0", darwinTarget)).toBe(
      "gran-v0.44.0-darwin-arm64",
    );
    expect(standaloneArchiveName("@kkarimi/gran", "0.44.0", windowsTarget)).toBe(
      "gran-v0.44.0-win32-x64.zip",
    );
  });

  test("throws for unsupported platforms", () => {
    expect(() => detectStandaloneTarget("linux", "ppc64")).toThrow(/Unsupported standalone host/);
    expect(() => parseStandaloneTarget("darwin-x64")).toThrow(/Unsupported standalone target/);
  });

  test("supported targets stay release-oriented", () => {
    expect(supportedStandaloneTargets).toEqual([
      {
        archiveExtension: "tar.gz",
        arch: "arm64",
        id: "darwin-arm64",
        platform: "darwin",
      },
      {
        archiveExtension: "tar.gz",
        arch: "x64",
        id: "linux-x64",
        platform: "linux",
      },
      {
        archiveExtension: "zip",
        arch: "x64",
        id: "win32-x64",
        platform: "win32",
      },
    ]);
  });
});
