# Contributing

Thanks for contributing to `@kkarimi/gran` and Gran 👵🏻.

## Before You Start

- Read the [README](./README.md) for product framing and install flow.
- Use the current repo build when testing locally:
  - `npm run web:restart`
  - `node dist/cli.js ...`
- Do not rely on an older `granola` binary elsewhere on your `PATH`.

## Local Setup

```bash
curl -fsSL https://vite.plus | bash
vp install
npm run web:build
vp pack
node dist/cli.js --help
```

## Development Workflow

1. Make a focused change.
2. Run the full local QA set.
3. Commit with a semantic commit message.
4. Push to `main` only when the tree is green.

## Required QA

Run this full set before pushing:

```bash
npm run web:build
npm run web:check
vp check
vp test
npm run coverage
npm run hooks:smoke
npm run standalone:smoke
vp pack
npm run docs:check
npm run browser:e2e
npm pack --dry-run
```

## Style Notes

- Keep the toolkit local-first.
- Prefer user-facing language over internal terms like “cache” when the UI is meant for normal users.
- Preserve one shared runtime across CLI, web, and TUI where possible.
- If you add config, auth, sync, or plugin behaviour, update tests and docs in the same change.

## Releases

- Normal contribution work does not need an npm release.
- Releases are cut intentionally once a batch of changes is ready.
- Keep release notes and README positioning honest.

## Reporting Issues

Helpful bug reports usually include:

- the command you ran
- whether you used CLI, web, or TUI
- auth mode in use
- whether the data came from live Granola, local index, or local snapshot
- any relevant screenshots or error output
