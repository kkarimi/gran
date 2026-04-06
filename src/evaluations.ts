import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve as resolvePath } from "node:path";

import type { GranolaAutomationEvaluationCase, GranolaMeetingBundle } from "./app/index.ts";
import type { CacheData, GranolaDocument } from "./types.ts";
import { asRecord, parseJsonString, stringValue } from "./utils.ts";

function parseBundle(value: unknown): GranolaMeetingBundle | undefined {
  const record = asRecord(value);
  const source = asRecord(record?.source);
  const sourceDocument = asRecord(source?.document);
  const meeting = asRecord(record?.meeting);
  if (sourceDocument && meeting) {
    return value as GranolaMeetingBundle;
  }

  const document = asRecord(record?.document);
  if (!document || !meeting) {
    return undefined;
  }

  const documentId = stringValue(document.id).trim();
  const cacheData = asRecord(record?.cacheData) as CacheData | undefined;
  const cacheDocument = documentId ? cacheData?.documents?.[documentId] : undefined;
  const transcriptSegments = documentId ? cacheData?.transcripts?.[documentId] : undefined;

  return {
    meeting: meeting as unknown as GranolaMeetingBundle["meeting"],
    source: {
      cacheDocument,
      document: {
        ...(document as unknown as GranolaDocument),
        transcriptSegments,
      },
    },
  };
}

function caseTitle(bundle: GranolaMeetingBundle, fallbackId: string): string {
  return (
    bundle.meeting.meeting.title?.trim() ||
    bundle.source.document.title?.trim() ||
    bundle.meeting.meeting.id ||
    bundle.source.document.id ||
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
    stringValue(record.id).trim() ||
    bundle.source.document.id ||
    bundle.meeting.meeting.id ||
    fallbackId;

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
