import { resolve as resolvePath } from "node:path";

import { initialiseGranolaToolkitProject, inspectGranolaToolkitProject } from "../init.ts";
import { defaultGranolaToolkitDataDirectory } from "../persistence/layout.ts";
import type { GranolaAgentProviderKind } from "../types.ts";

import { maybeRunGuidedSetupAfterInit } from "./guided-setup.ts";
import type { CommandDefinition } from "./types.ts";

function initHelp(): string {
  return `Gran init

Usage:
  gran init [options]

Create a local project bootstrap with:
  - config.json in ~/.config/gran by default
  - starter automation rules
  - starter harness definitions
  - prompt files for common meeting types

Options:
  --dir <path>        Target directory (default: ~/.config/gran, or current directory with --project)
  --force             Overwrite existing generated files
  --guided            Start guided setup immediately after bootstrap
  --model <value>     Override the starter model for generated harnesses
  --project           Create ./.gran/config.json and ./.gran/ in the target directory instead
  --provider <value>  codex, openai, openrouter (default: codex)
  --skip-guide        Skip the interactive guided setup prompt
  -h, --help          Show help
`;
}

function parseProvider(value: string | boolean | undefined): GranolaAgentProviderKind {
  switch (value) {
    case undefined:
      return "codex";
    case "codex":
    case "openai":
    case "openrouter":
      return value;
    default:
      throw new Error("invalid init provider: expected codex, openai, or openrouter");
  }
}

function providerNextStep(provider: GranolaAgentProviderKind): string {
  switch (provider) {
    case "openai":
      return "2. Export OPENAI_API_KEY in the shell or service that runs your sync loop.";
    case "openrouter":
      return "2. Export OPENROUTER_API_KEY in the shell or service that runs your sync loop.";
    default:
      return "2. Make sure `codex exec` works locally before you enable agent-driven automation.";
  }
}

export const initCommand: CommandDefinition = {
  description: "Create a local Gran project bootstrap",
  flags: {
    dir: { type: "string" },
    force: { type: "boolean" },
    guided: { type: "boolean" },
    help: { type: "boolean" },
    model: { type: "string" },
    project: { type: "boolean" },
    provider: { type: "string" },
    "skip-guide": { type: "boolean" },
  },
  help: initHelp,
  name: "init",
  async run({ commandArgs, commandFlags, globalFlags }) {
    if (commandArgs.length > 0) {
      throw new Error("gran init does not accept positional arguments");
    }

    const scope = commandFlags.project === true ? "project" : "global";
    const directory =
      typeof commandFlags.dir === "string" && commandFlags.dir.trim()
        ? commandFlags.dir.trim()
        : scope === "project"
          ? process.cwd()
          : defaultGranolaToolkitDataDirectory();
    const provider = parseProvider(commandFlags.provider);
    const force = commandFlags.force === true;
    const bootstrap = await inspectGranolaToolkitProject(directory, scope);
    const root = resolvePath(bootstrap.directory);
    let configPath = bootstrap.configPath;

    if (bootstrap.isComplete && !force) {
      console.log(`Found an existing Gran setup in ${root}`);
      console.log("");
      console.log("Reusing:");
      console.log(scope === "project" ? "  ./.gran/config.json" : "  config.json");
      console.log(scope === "project" ? "  ./.gran/" : "  prompts/");
    } else {
      if (bootstrap.hasAnyFiles && !force) {
        throw new Error(
          `gran init found an incomplete setup in ${root}.\nExisting files:\n${bootstrap.existingFiles
            .map((filePath) => `- ${filePath}`)
            .join("\n")}\nMissing files:\n${bootstrap.missingFiles
            .map((filePath) => `- ${filePath}`)
            .join("\n")}\nRe-run with --force to replace the generated files.`,
        );
      }

      const result = await initialiseGranolaToolkitProject({
        directory,
        force,
        model: typeof commandFlags.model === "string" ? commandFlags.model.trim() : undefined,
        provider,
        scope,
      });
      configPath = result.configPath;

      console.log(`Created Gran setup in ${root}`);
      console.log("");
      console.log("Files:");
      console.log(scope === "project" ? "  ./.gran/config.json" : "  config.json");
      console.log(scope === "project" ? "  ./.gran/" : "  prompts/");
    }

    const guidedExitCode = await maybeRunGuidedSetupAfterInit({
      commandFlags,
      configPath,
      globalFlags,
    });
    if (guidedExitCode !== undefined) {
      return guidedExitCode;
    }

    console.log("");
    console.log("Next:");
    console.log("  gran web");
    console.log("  gran tui");
    console.log("");
    console.log(providerNextStep(provider));
    console.log(
      scope === "project"
        ? "Edit ./.gran/prompts/ when you want to tune meeting-specific agent output."
        : `Edit ${root}/prompts/ when you want to tune meeting-specific agent output.`,
    );
    return 0;
  },
};
