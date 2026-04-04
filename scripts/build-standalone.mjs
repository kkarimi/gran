#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cp, chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { build } from "esbuild";

import {
  detectStandaloneTarget,
  parseStandaloneTarget,
  standaloneArchiveName,
  standaloneAssetBaseName,
  standaloneCommandName,
  standaloneExecutableName,
} from "./standalone-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const packageJsonPath = resolve(root, "package.json");
const postjectCliPath = resolve(root, "node_modules", "postject", "dist", "cli.js");
const seaFuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function readPackageJson() {
  return JSON.parse(readFileSync(packageJsonPath, "utf8"));
}

function parseArgs(argv) {
  const options = {
    outputDir: "dist/release-assets",
    smokeTest: false,
    target: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--output-dir") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --output-dir");
      }
      options.outputDir = value;
      index += 1;
      continue;
    }

    if (argument === "--smoke-test") {
      options.smokeTest = true;
      continue;
    }

    if (argument === "--target") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --target");
      }
      options.target = value;
      index += 1;
      continue;
    }

    throw new Error(`unknown argument: ${argument}`);
  }

  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(
      [`Command failed: ${command} ${args.join(" ")}`, details].filter(Boolean).join("\n"),
    );
  }

  return result;
}

function powerShellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function standaloneReadme(target) {
  const executable = standaloneExecutableName(standaloneCommandName, target);
  const invoke = target.platform === "win32" ? `.\\${executable} --help` : `./${executable} --help`;

  return [
    "Granola Toolkit standalone binary",
    "",
    `Target: ${target.id}`,
    `Command: ${executable}`,
    "",
    "Quick start:",
    `  ${invoke}`,
    "",
    "This binary is self-contained and does not require Node.js or npm on the target machine.",
  ].join("\n");
}

async function archiveStandaloneDirectory(target, assetDir, archivePath, archiveRootDir) {
  if (target.platform === "win32") {
    run("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -LiteralPath ${powerShellLiteral(assetDir)} -DestinationPath ${powerShellLiteral(
        archivePath,
      )} -Force`,
    ]);
    return;
  }

  run("tar", ["-czf", archivePath, "-C", archiveRootDir, basename(assetDir)]);
}

async function buildStandalone() {
  const options = parseArgs(process.argv.slice(2));
  const currentTarget = detectStandaloneTarget();
  const target = options.target ? parseStandaloneTarget(options.target) : currentTarget;
  if (target.id !== currentTarget.id) {
    throw new Error(
      `Standalone builds must run on a matching host. Requested ${target.id}, current host is ${currentTarget.id}.`,
    );
  }

  const pkg = readPackageJson();
  const outputDir = resolve(root, options.outputDir);
  const assetBaseName = standaloneAssetBaseName(pkg.name, pkg.version, target);
  const assetDir = resolve(outputDir, assetBaseName);
  const archivePath = resolve(outputDir, standaloneArchiveName(pkg.name, pkg.version, target));
  const executableName = standaloneExecutableName(standaloneCommandName, target);
  const executablePath = resolve(assetDir, executableName);
  const tempDir = await mkdtemp(join(tmpdir(), "granola-standalone-"));

  try {
    await rm(assetDir, { force: true, recursive: true });
    await rm(archivePath, { force: true });
    await mkdir(assetDir, { recursive: true });

    const bundlePath = resolve(tempDir, "standalone.cjs");
    const blobPath = resolve(tempDir, "sea-prep.blob");
    const configPath = resolve(tempDir, "sea-config.json");
    const targetMajor = process.versions.node.split(".")[0];

    await build({
      absWorkingDir: root,
      banner: {
        js: 'const __granola_import_meta_url = require("node:url").pathToFileURL(__filename).href;',
      },
      bundle: true,
      define: {
        "import.meta.url": "__granola_import_meta_url",
      },
      entryPoints: [resolve(root, "standalone.ts")],
      format: "cjs",
      legalComments: "none",
      outfile: bundlePath,
      platform: "node",
      target: [`node${targetMajor}`],
    });

    await writeFile(
      configPath,
      JSON.stringify(
        {
          disableExperimentalSEAWarning: true,
          main: bundlePath,
          output: blobPath,
          useCodeCache: false,
        },
        null,
        2,
      ),
    );

    run(process.execPath, ["--experimental-sea-config", configPath]);
    await cp(process.execPath, executablePath);

    if (target.platform === "darwin") {
      run("codesign", ["--remove-signature", executablePath]);
    }

    const postjectArgs = [
      postjectCliPath,
      executablePath,
      "NODE_SEA_BLOB",
      blobPath,
      "--sentinel-fuse",
      seaFuse,
    ];
    if (target.platform === "darwin") {
      postjectArgs.push("--macho-segment-name", "NODE_SEA");
    }
    run(process.execPath, postjectArgs);

    if (target.platform === "darwin") {
      run("codesign", ["--sign", "-", executablePath]);
    } else if (target.platform !== "win32") {
      await chmod(executablePath, 0o755);
    }

    await writeFile(resolve(assetDir, "README.txt"), standaloneReadme(target), "utf8");
    await archiveStandaloneDirectory(target, assetDir, archivePath, outputDir);

    if (options.smokeTest) {
      run(executablePath, ["--help"], { stdio: "inherit" });
    }

    console.log(`Built standalone executable: ${executablePath}`);
    console.log(`Built release archive: ${archivePath}`);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

try {
  await buildStandalone();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
