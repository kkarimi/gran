import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { GranolaPkmTarget } from "./app/index.ts";
import { defaultGranolaToolkitPersistenceLayout } from "./persistence/layout.ts";
import { asRecord, parseJsonString, stringValue } from "./utils.ts";

interface PkmTargetsFile {
  targets: GranolaPkmTarget[];
}

function cloneTarget(target: GranolaPkmTarget): GranolaPkmTarget {
  return { ...target };
}

function normaliseTarget(value: unknown): GranolaPkmTarget | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const id = stringValue(record.id).trim();
  const outputDir = stringValue(record.outputDir).trim();
  const kind = stringValue(record.kind).trim();
  if (!id || !outputDir || (kind !== "docs-folder" && kind !== "obsidian")) {
    return undefined;
  }

  return {
    filenameTemplate: stringValue(record.filenameTemplate).trim() || undefined,
    folderSubdirectories:
      typeof record.folderSubdirectories === "boolean" ? record.folderSubdirectories : undefined,
    frontmatter: typeof record.frontmatter === "boolean" ? record.frontmatter : undefined,
    id,
    kind,
    name: stringValue(record.name).trim() || undefined,
    outputDir,
  };
}

function normaliseFile(parsed: unknown): PkmTargetsFile {
  const record = asRecord(parsed);
  if (!record || !Array.isArray(record.targets)) {
    return { targets: [] };
  }

  return {
    targets: record.targets
      .map((target) => normaliseTarget(target))
      .filter((target): target is GranolaPkmTarget => Boolean(target)),
  };
}

export interface PkmTargetStore {
  readTargets(): Promise<GranolaPkmTarget[]>;
  writeTargets(targets: GranolaPkmTarget[]): Promise<void>;
}

export class MemoryPkmTargetStore implements PkmTargetStore {
  constructor(private readonly targets: GranolaPkmTarget[] = []) {}

  async readTargets(): Promise<GranolaPkmTarget[]> {
    return this.targets.map((target) => cloneTarget(target));
  }

  async writeTargets(targets: GranolaPkmTarget[]): Promise<void> {
    this.targets.splice(0, this.targets.length, ...targets.map((target) => cloneTarget(target)));
  }
}

export class FilePkmTargetStore implements PkmTargetStore {
  constructor(private readonly filePath: string = defaultPkmTargetsFilePath()) {}

  async readTargets(): Promise<GranolaPkmTarget[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      return normaliseFile(parseJsonString(contents)).targets.map((target) => cloneTarget(target));
    } catch {
      return [];
    }
  }

  async writeTargets(targets: GranolaPkmTarget[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify({ targets }, null, 2)}\n`, "utf8");
  }
}

export function defaultPkmTargetsFilePath(): string {
  return defaultGranolaToolkitPersistenceLayout().pkmTargetsFile;
}

export function createDefaultPkmTargetStore(filePath?: string): PkmTargetStore {
  return new FilePkmTargetStore(filePath);
}
