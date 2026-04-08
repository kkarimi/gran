#!/usr/bin/env node

import {
  compareUrl,
  extractChangelogEntry,
  previousTag,
  previousTagBefore,
  readChangelog,
  readPackageMetadata,
  releaseChanges,
  renderReleaseEntry,
  upsertReleaseArtefacts,
} from "./release-data.mjs";

const pkg = readPackageMetadata();
const repository = process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}`
  : "https://github.com/kkarimi/gran";
const version = process.env.PACKAGE_VERSION ?? pkg.version;
const packageName = process.env.PACKAGE_NAME ?? pkg.name;

function fallbackNotes() {
  const baseTag = previousTagBefore(`v${version}`) || previousTag();
  const changes = releaseChanges({ repository, baseTag });
  const date = new Date().toISOString().slice(0, 10);

  return renderReleaseEntry({
    packageName,
    version,
    date,
    repository,
    homepage: pkg.homepage,
    baseTag,
    changes,
  });
}

function releaseNotes() {
  const entry = extractChangelogEntry(readChangelog(), version);
  const baseTag = previousTagBefore(`v${version}`) || previousTag();
  const notes = upsertReleaseArtefacts(entry || fallbackNotes(), {
    baseTag,
    homepage: pkg.homepage,
    packageName,
    repository,
    version,
  });
  const fullChangelog = compareUrl({ repository, baseTag, version });

  return [notes, "", `**Full Changelog**: ${fullChangelog}`].join("\n");
}

process.stdout.write(`${releaseNotes().trim()}\n`);
