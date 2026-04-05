#!/usr/bin/env node

import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const hooksDir = resolve(root, ".vite-hooks");
const preCommitPath = resolve(hooksDir, "pre-commit");
const preCommitScript = "node scripts/pre-commit.mjs\n";

mkdirSync(hooksDir, { recursive: true });
writeFileSync(preCommitPath, preCommitScript, "utf8");
chmodSync(preCommitPath, 0o755);
