#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";

const root = resolve(import.meta.dirname, "..");
const webBundleEntry = "src/web-app/main.tsx";
const directWebBundleInputs = new Set(["scripts/build-web-client.mjs", "vite.config.ts"]);
const moduleExtensions = [".ts", ".tsx", ".js", ".jsx", ".css"];
const importPatterns = [
  /(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?["'](\.[^"']+)["']/g,
  /import\(\s*["'](\.[^"']+)["']\s*\)/g,
];
const cssImportPattern = /@import\s+["'](\.[^"']+)["']/g;

function normalisePath(path) {
  return path.replaceAll("\\", "/");
}

function relativeFromRoot(path) {
  return normalisePath(relative(root, path));
}

function resolveModulePath(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    ...moduleExtensions.map((extension) => `${base}${extension}`),
    ...moduleExtensions.map((extension) => resolve(base, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to resolve web bundle dependency ${specifier} from ${relativeFromRoot(fromFile)}.`,
  );
}

function dependencySpecifiers(source, path) {
  const specifiers = new Set();
  const patterns = path.endsWith(".css") ? [cssImportPattern] : importPatterns;

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }

  return specifiers;
}

export function listWebBundleInputs() {
  const visited = new Set();
  const pending = [resolve(root, webBundleEntry)];

  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path)) {
      continue;
    }

    visited.add(path);

    const source = readFileSync(path, "utf8");
    const specifiers = dependencySpecifiers(source, path);
    for (const specifier of specifiers) {
      pending.push(resolveModulePath(path, specifier));
    }
  }

  return Array.from(
    new Set([...Array.from(visited, (path) => relativeFromRoot(path)), ...directWebBundleInputs]),
  ).sort((left, right) => left.localeCompare(right));
}

export function affectsWebBundle(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return false;
  }

  const inputs = new Set(listWebBundleInputs());
  return files.map(normalisePath).some((file) => inputs.has(file));
}
