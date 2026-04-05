#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);

execFileSync("vp", ["check", "--fix", ...args], {
  cwd: root,
  stdio: "inherit",
});
