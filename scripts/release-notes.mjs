#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const repository = process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}`
  : "https://github.com/kkarimi/granola-toolkit";
const version = process.env.PACKAGE_VERSION ?? pkg.version;
const packageName = process.env.PACKAGE_NAME ?? pkg.name;
const tag = `v${version}`;

function execText(command) {
  try {
    return execSync(command, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function releaseHighlights() {
  const previousTag = execText(`git describe --tags --abbrev=0 "${tag}^"`);
  const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
  const subjects = execText(`git log --format=%s ${range}`)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^chore: release v/i.test(line))
    .slice(0, 6);

  if (subjects.length === 0) {
    return [];
  }

  return ["## Highlights", "", ...subjects.map((subject) => `- ${subject}`), ""];
}

const lines = [
  ...releaseHighlights(),
  "## Release Metadata",
  "",
  `- npm: [${packageName}@${version}](https://www.npmjs.com/package/${packageName}/v/${version})`,
  `- install: \`npm install -g ${packageName}@${version}\``,
  `- standalone binaries: ${repository}/releases/tag/${tag}`,
  `- docs: ${pkg.homepage}`,
  `- compare: ${repository}/compare/${tag}^...${tag}`,
];

process.stdout.write(`${lines.join("\n")}\n`);
