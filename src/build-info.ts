import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface GranolaBuildInfo {
  gitCommit?: string;
  gitCommitShort?: string;
  packageName: string;
  repositoryUrl?: string;
  version: string;
}

interface PackageJsonShape {
  name?: unknown;
  repository?: unknown;
  version?: unknown;
}

let cachedBuildInfo: GranolaBuildInfo | undefined;

function packageRootPath(): string {
  return dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
}

function readPackageJson(): PackageJsonShape {
  try {
    return JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as PackageJsonShape;
  } catch {
    return {};
  }
}

function repositoryUrlFromPackageJson(repository: unknown): string | undefined {
  if (typeof repository === "string" && repository.trim()) {
    return repository.trim();
  }

  if (
    repository &&
    typeof repository === "object" &&
    "url" in repository &&
    typeof repository.url === "string" &&
    repository.url.trim()
  ) {
    return repository.url.trim();
  }

  return undefined;
}

function readGitCommit(rootDir: string): string | undefined {
  if (
    typeof process.env.GRANOLA_TOOLKIT_GIT_SHA === "string" &&
    process.env.GRANOLA_TOOLKIT_GIT_SHA.trim()
  ) {
    return process.env.GRANOLA_TOOLKIT_GIT_SHA.trim();
  }

  try {
    return execFileSync("git", ["-C", rootDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

export function resolveGranolaBuildInfo(): GranolaBuildInfo {
  if (cachedBuildInfo) {
    return cachedBuildInfo;
  }

  const rootDir = packageRootPath();
  const packageJson = readPackageJson();
  const gitCommit = readGitCommit(rootDir);

  cachedBuildInfo = {
    gitCommit,
    gitCommitShort: gitCommit ? gitCommit.slice(0, 7) : undefined,
    packageName:
      typeof packageJson.name === "string" && packageJson.name.trim()
        ? packageJson.name.trim()
        : "granola-toolkit",
    repositoryUrl: repositoryUrlFromPackageJson(packageJson.repository),
    version:
      typeof packageJson.version === "string" && packageJson.version.trim()
        ? packageJson.version.trim()
        : "0.0.0",
  };

  return cachedBuildInfo;
}
