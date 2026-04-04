#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);

function run(command, commandArgs) {
  execFileSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
  });
}

function stagedFiles() {
  const output = execFileSync("git", ["diff", "--cached", "--name-only"], {
    cwd: root,
    encoding: "utf8",
  });

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function needsWebBundle(files) {
  return files.some(
    (file) =>
      file.startsWith("src/web-app/") ||
      file === "scripts/build-web-client.mjs" ||
      file === "vite.config.ts",
  );
}

run("vp", ["check", "--fix", ...args]);

const files = stagedFiles();
if (needsWebBundle(files)) {
  run("npm", ["run", "web:build", ...args]);
  run("git", ["add", "src/web/generated.ts"]);
}
