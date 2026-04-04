import { createGranolaApp, type GranolaAppAuthState } from "../app/index.ts";
import { loadConfig } from "../config.ts";

import { debug } from "./shared.ts";
import type { CommandDefinition } from "./types.ts";

function authHelp(): string {
  return `Granola auth

Usage:
  granola auth <login|status|logout|refresh|use> [options]

Subcommands:
  login               Import credentials from the Granola desktop app
  status              Show the current Granola auth state
  logout              Delete the stored Granola session
  refresh             Refresh the stored Granola session
  use <stored|supabase>
                      Switch the active auth source for this toolkit instance

Options:
  --supabase <path>   Path to supabase.json for auth login
  --config <path>     Path to .granola.toml
  --debug             Enable debug logging
  -h, --help          Show help
`;
}

function formatAuthSource(mode: string): string {
  return mode === "stored-session" ? "stored session" : "supabase.json";
}

function printAuthState(state: GranolaAppAuthState): void {
  console.log(`Active source: ${formatAuthSource(state.mode)}`);
  console.log(`Stored session: ${state.storedSessionAvailable ? "available" : "missing"}`);
  console.log(`supabase.json: ${state.supabaseAvailable ? "available" : "missing"}`);
  if (state.supabasePath) {
    console.log(`supabase path: ${state.supabasePath}`);
  }
  if (state.clientId) {
    console.log(`Client ID: ${state.clientId}`);
  }
  console.log(`Refresh token: ${state.refreshAvailable ? "available" : "missing"}`);
  if (state.signInMethod) {
    console.log(`Sign-in method: ${state.signInMethod}`);
  }
  if (state.lastError) {
    console.log(`Last error: ${state.lastError}`);
  }
}

export const authCommand: CommandDefinition = {
  description: "Manage stored Granola sessions",
  flags: {
    help: { type: "boolean" },
  },
  help: authHelp,
  name: "auth",
  async run({ commandArgs, globalFlags }) {
    const [action, value] = commandArgs;
    const config = await loadConfig({
      globalFlags,
      subcommandFlags: {},
    });

    debug(config.debug, "using config", config.configFileUsed ?? "(none)");
    debug(config.debug, "supabase", config.supabase);

    const app = await createGranolaApp(config);

    switch (action) {
      case "login": {
        const state = await app.loginAuth();
        console.log(
          `Imported Granola session from ${state.supabasePath ?? "desktop app defaults"}`,
        );
        printAuthState(state);
        return 0;
      }
      case "logout": {
        const state = await app.logoutAuth();
        console.log("Stored Granola session deleted");
        printAuthState(state);
        return 0;
      }
      case "refresh": {
        const state = await app.refreshAuth();
        console.log("Stored Granola session refreshed");
        printAuthState(state);
        return 0;
      }
      case "status": {
        const state = await app.inspectAuth();
        printAuthState(state);
        return state.storedSessionAvailable ? 0 : 1;
      }
      case "use": {
        const mode = resolveAuthMode(value);
        const state = await app.switchAuthMode(mode);
        console.log(`Switched auth source to ${formatAuthSource(state.mode)}`);
        printAuthState(state);
        return 0;
      }
      case undefined:
        console.log(authHelp());
        return 1;
      default:
        throw new Error("invalid auth command: expected login, status, logout, refresh, or use");
    }
  },
};

function resolveAuthMode(value: string | undefined): "stored-session" | "supabase-file" {
  switch (value) {
    case "stored":
    case "stored-session":
      return "stored-session";
    case "supabase":
    case "supabase-file":
      return "supabase-file";
    default:
      throw new Error("invalid auth mode: expected stored or supabase");
  }
}
