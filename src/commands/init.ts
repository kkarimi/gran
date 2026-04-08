import { relative, resolve as resolvePath } from "node:path";

import { initialiseGranolaToolkitProject } from "../init.ts";
import type { GranolaAgentProviderKind } from "../types.ts";

import type { CommandDefinition } from "./types.ts";

function initHelp(): string {
  return `Gran init

Usage:
  gran init [options]

Create a local project bootstrap with:
  - .gran.json
  - starter automation rules
  - starter harness definitions
  - prompt files for common meeting types

Options:
  --dir <path>        Target directory (default: current directory)
  --force             Overwrite existing generated files
  --model <value>     Override the starter model for generated harnesses
  --provider <value>  codex, openai, openrouter (default: codex)
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
    help: { type: "boolean" },
    model: { type: "string" },
    provider: { type: "string" },
  },
  help: initHelp,
  name: "init",
  async run({ commandArgs, commandFlags }) {
    if (commandArgs.length > 0) {
      throw new Error("gran init does not accept positional arguments");
    }

    const directory =
      typeof commandFlags.dir === "string" && commandFlags.dir.trim()
        ? commandFlags.dir.trim()
        : process.cwd();
    const provider = parseProvider(commandFlags.provider);
    const result = await initialiseGranolaToolkitProject({
      directory,
      force: commandFlags.force === true,
      model: typeof commandFlags.model === "string" ? commandFlags.model.trim() : undefined,
      provider,
    });
    const root = resolvePath(result.directory);

    console.log(`Initialised Gran 👵🏻 in ${root}`);
    console.log("");
    console.log("Created:");
    for (const filePath of result.createdFiles) {
      console.log(`  - ./${relative(root, filePath)}`);
    }
    console.log("");
    console.log("Next:");
    console.log("1. Store Gran auth once with `gran auth login --api-key grn_...`.");
    console.log(providerNextStep(provider));
    console.log(
      "3. Edit the prompt files under ./.gran/prompts/ to match your real meeting types.",
    );
    console.log("4. Run `gran sync --config ./.gran.json` and `gran web --config ./.gran.json`.");
    console.log(
      "5. If your folders are not named Team or Customers, adjust ./.gran/automation-rules.json and ./.gran/agent-harnesses.json before enabling a watch loop.",
    );
    return 0;
  },
};
