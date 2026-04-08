# Gran 👵🏻

[![npm version](https://img.shields.io/npm/v/%40kkarimi%2Fgran?label=npm)](https://www.npmjs.com/package/@kkarimi/gran)
[![CI](https://img.shields.io/github/actions/workflow/status/kkarimi/gran/ci.yml?branch=main&label=ci)](https://github.com/kkarimi/gran/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-live-0f766e)](https://kkarimi.github.io/gran/)
[![License](https://img.shields.io/github/license/kkarimi/gran)](https://github.com/kkarimi/gran/blob/main/LICENSE)

The unofficial open-source Swiss army knife for Granola.

Sync your meeting archive locally, browse it in the browser or terminal, export anything you need,
and run your own agents against transcripts and notes.

> `gran` is for people who want more than a flat export command:
> a local-first Granola archive, a real browser and terminal workspace, and automation you control.

## Why Use It

- Local-first control instead of being trapped in one app surface
- CLI, browser, and TUI on one shared runtime and one local index
- Bring your own agent workflows on top of transcripts and notes
- Export notes and transcripts into files you actually own
- Open-source and scriptable, with local prompts, rules, skills, and plugins

## What You Get

- `gran sync` for local indexing and refresh
- `gran web` for a browser workspace
- `gran tui` / `gran attach` for keyboard-first terminal use
- `gran export` for bundled note + transcript exports
- `gran targets` for named vaults, folders, and export profiles
- `gran intelligence` for built-in presets like decisions and action items
- `gran automation` plus harnesses/rules for BYOA review workflows
- `@kkarimi/gran-sdk` for Node and TypeScript integrations on the same local-first core
- local diagnostics, sync history, and inspectable runtime state

## Install

```bash
npm install -g @kkarimi/gran
gran --help
```

Without a global install:

```bash
npx @kkarimi/gran --help
```

If you want the SDK instead of the CLI:

```bash
npm install @kkarimi/gran-sdk
```

If you do not want to install via npm, each GitHub release also publishes standalone archives for
macOS arm64, Linux x64, and Windows x64. Extract the archive and run `gran` (or `gran.exe` on
Windows).

## Quick Start

```bash
gran init --provider openrouter
gran auth login --api-key grn_...
gran targets add --id work-vault --kind obsidian-vault --output ~/Vaults/Work --daily-notes-dir Daily
gran export --target work-vault
gran web
```

`gran init` creates a local `.gran.json`, starter harnesses, starter automation rules, and
prompt files under `./.gran/` so the first-run setup is not just “read docs and assemble JSON by
hand”.

If you start with `gran web`, the browser walks you through the same first-run path:
enter a Granola API key, import your meetings, choose an agent provider, and land in a workspace
with a starter reviewable notes pipeline already configured.

`gran web` prefers the long-running background-service path by default: it will reuse the
existing service when one is already running, or start it for you when you have not asked for a
foreground/debug session.

`gran service start` is available when you want to warm the local sync loop without
opening a browser first.

If you prefer to reuse the desktop app session instead, `gran auth login` imports it from
`supabase.json`.

## Set Default Configuration

`gran init` writes a project-local `.gran.json` for you. If you want to edit it directly,
the file can look like this:

```json
{
  "agent-provider": "openrouter",
  "agent-model": "openai/gpt-5-mini",
  "agent-harnesses-file": "./.gran/agent-harnesses.json",
  "automation-rules-file": "./.gran/automation-rules.json",
  "pkm-targets-file": "./.gran/pkm-targets.json",
  "output": "./exports/notes",
  "transcript-output": "./exports/transcripts",
  "debug": false
}
```

The CLI reads configuration in this order:

1. command-line flags
2. environment variables
3. `.gran.json`
4. platform defaults

Relative paths in `.gran.json` resolve from the directory that contains the config file.

## Debug Logging

Yes, the toolkit supports a real debug mode.

```bash
gran sync --debug
gran web --debug --foreground
DEBUG_MODE=1 gran service start
```

Useful when you want to see config resolution, auth mode selection, sync behaviour, and runtime
paths while diagnosing local-state issues.

## Documentation

The detailed documentation lives at
[`kkarimi.github.io/gran`](https://kkarimi.github.io/gran/).

Local docs development:

```bash
npm run docs:dev
npm run docs:check
```

Key docs entry points:

- [`Overview`](https://kkarimi.github.io/gran/docs/)
- [`Getting Started`](https://kkarimi.github.io/gran/docs/getting-started/)
- [`SDK`](https://kkarimi.github.io/gran/docs/sdk/)
- [`Automation`](https://kkarimi.github.io/gran/docs/automation/)
- [`Server, Web, and TUI`](https://kkarimi.github.io/gran/docs/server-web-and-tui/)
- [`Auth and Configuration`](https://kkarimi.github.io/gran/docs/auth-and-configuration/)
- [`Exporting`](https://kkarimi.github.io/gran/docs/exporting/)
- [`Meetings and Folders`](https://kkarimi.github.io/gran/docs/meetings-and-folders/)
- [`Agent Skills`](https://kkarimi.github.io/gran/docs/agent-skills/)
- [`Architecture`](https://kkarimi.github.io/gran/docs/architecture/)
- [`Releases`](https://kkarimi.github.io/gran/docs/releases/)
- [`Development`](https://kkarimi.github.io/gran/docs/development/)

Release history is also tracked in
[`CHANGELOG.md`](https://github.com/kkarimi/gran/blob/main/CHANGELOG.md).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, QA
expectations, and contribution workflow.

## Local Development

```bash
curl -fsSL https://vite.plus | bash
vp install
npm run web:check
vp pack
node dist/cli.js --help
```
