import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { FilePluginSettingsStore, MemoryPluginSettingsStore } from "../src/plugins.ts";

describe("plugin settings stores", () => {
  test("default to shipped plugin states in memory", async () => {
    const store = new MemoryPluginSettingsStore();

    await expect(store.readSettings()).resolves.toEqual({
      enabled: {
        automation: false,
        "markdown-viewer": true,
      },
    });
  });

  test("persist plugin enabled state to disk", async () => {
    const directory = await mkdtemp(join(tmpdir(), "granola-plugin-settings-"));
    const filePath = join(directory, "plugins.json");
    const store = new FilePluginSettingsStore(filePath);

    await store.writeSettings({
      enabled: {
        automation: true,
        "markdown-viewer": false,
      },
    });

    await expect(store.readSettings()).resolves.toEqual({
      enabled: {
        automation: true,
        "markdown-viewer": false,
      },
    });
  });

  test("reads legacy boolean settings into the generic enabled map", async () => {
    const directory = await mkdtemp(join(tmpdir(), "granola-plugin-settings-"));
    const filePath = join(directory, "plugins.json");
    await writeFile(
      filePath,
      `${JSON.stringify({
        automationEnabled: true,
        markdownViewerEnabled: false,
      })}\n`,
      "utf8",
    );

    const store = new FilePluginSettingsStore(filePath);

    await expect(store.readSettings()).resolves.toEqual({
      enabled: {
        automation: true,
        "markdown-viewer": false,
      },
    });
  });
});
