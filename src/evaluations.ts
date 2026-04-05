import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve as resolvePath } from "node:path";

import type { GranolaAutomationEvaluationCase, GranolaMeetingBundle } from "./app/index.ts";
import { asRecord, parseJsonString, stringValue } from "./utils.ts";

function parseBundle(value: unknown): GranolaMeetingBundle | undefined {
  const record = asRecord(value);
  const document = asRecord(record?.document);
  const meeting = asRecord(record?.meeting);
  if (!document || !meeting) {
    return undefined;
  }

  return value as GranolaMeetingBundle;
}

function caseTitle(bundle: GranolaMeetingBundle, fallbackId: string): string {
  return (
    bundle.meeting.meeting.title?.trim() ||
    bundle.document.title?.trim() ||
    bundle.meeting.meeting.id ||
    bundle.document.id ||
    fallbackId
  );
}

function parseCase(
  value: unknown,
  fallbackId: string,
): GranolaAutomationEvaluationCase | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const nestedBundle = parseBundle(record.bundle);
  const bundle = nestedBundle ?? parseBundle(record);
  if (!bundle) {
    return undefined;
  }

  const id =
    stringValue(record.id).trim() || bundle.document.id || bundle.meeting.meeting.id || fallbackId;

  return {
    bundle,
    id,
    title: stringValue(record.title).trim() || caseTitle(bundle, id),
  };
}

function parseCasesFromText(
  contents: string,
  sourceLabel: string,
): GranolaAutomationEvaluationCase[] {
  const parsed = parseJsonString<unknown>(contents);
  if (!parsed) {
    throw new Error(`failed to parse evaluation JSON: ${sourceLabel}`);
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((value, index) => parseCase(value, `${sourceLabel}:${index + 1}`))
      .filter((value): value is GranolaAutomationEvaluationCase => Boolean(value));
  }

  const record = asRecord(parsed);
  if (!record) {
    return [];
  }

  if (Array.isArray(record.cases)) {
    return record.cases
      .map((value, index) => parseCase(value, `${sourceLabel}:${index + 1}`))
      .filter((value): value is GranolaAutomationEvaluationCase => Boolean(value));
  }

  const single = parseCase(record, sourceLabel);
  return single ? [single] : [];
}

export async function readAutomationEvaluationCases(
  fixturePath: string,
): Promise<GranolaAutomationEvaluationCase[]> {
  const resolved = resolvePath(fixturePath);
  const details = await stat(resolved);

  if (details.isDirectory()) {
    const entries = (await readdir(resolved))
      .filter((entry) => extname(entry).toLowerCase() === ".json")
      .sort();
    const cases: GranolaAutomationEvaluationCase[] = [];

    for (const entry of entries) {
      const sourceLabel = basename(entry, ".json");
      const contents = await readFile(join(resolved, entry), "utf8");
      cases.push(...parseCasesFromText(contents, sourceLabel));
    }

    return cases;
  }

  return parseCasesFromText(await readFile(resolved, "utf8"), basename(resolved, ".json"));
}
