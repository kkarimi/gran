# SDK And Multi-Package TODO

North star: ship a real Node and TypeScript SDK alongside the CLI so other tools can build on Gran 👵🏻 without shelling out to commands.

## Useful Vite+ Pieces

- `vp run` supports workspace task execution with `package#task`, `--recursive`, and `--filter`.
- `vp pack` forwards to `tsdown`, which gives us a clean library-build path with declaration generation.
- Vite+ does not replace npm's workspace publishing model; the practical pairing is `vp run` + `vp pack` for per-package QA/builds and npm workspaces for version/publish orchestration.
- That means we can keep one repo, use npm workspaces for package layout, and still use Vite+ per package instead of inventing a second build toolchain.

## Guardrails

- Start with one SDK package, not a broad monorepo refactor.
- Expose a stable Node-first API surface instead of leaking the entire internal tree.
- Keep the CLI as the product root; the SDK should wrap the same core, not fork it.
- Use workspace-local `vp check`, `vp test`, and `vp pack` so package boundaries stay honest.
- Keep `main` shippable after each slice: full QA, commit, and push. Hold releases until the batch feels coherent.

| Priority | Status | Size | Published In | Area                         | Task                                                                                                      | Why                                                                                |
| -------- | ------ | ---- | ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P1       | Done   | M    |              | SDK / Workspace Foundation   | Add an npm workspace package for the SDK, with its own Vite+/tsdown build, tests, and root task wiring.   | This is the minimum viable structure for shipping a second package cleanly.        |
| P1       | Done   | M    |              | SDK / Stable Node API        | Expose a typed Node API for config loading, app creation, auth inspection, client helpers, and key types. | Users need a clean API, not direct imports from internal app files.                |
| P1       | Done   | S    |              | SDK / Package Docs           | Add a package README and first examples that show `createGranSdk()` and common list/search/sync flows.    | A package is not usable if the import story is still hidden in repo internals.     |
| P2       | Done   | M    |              | SDK / Export Helpers         | Add higher-level helpers for bundled exports, named targets, and meeting retrieval without CLI parsing.   | The SDK should make common archive tasks easier than wrapping shell commands.      |
| P2       | Done   | M    |              | SDK / Service Client         | Add a typed client for talking to a local Gran service over the existing transport layer.                 | This unlocks external browser and agent integrations without re-embedding the app. |
| P2       | Done   | M    |              | Release / Multi-Package Flow | Update CI and release tooling so the CLI and SDK can be versioned, packed, and published together.        | A second package needs explicit release plumbing before we call it shippable.      |
| P3       | Done   | M    |              | SDK / Docs Site              | Add SDK docs pages and examples to the docs site once the API settles.                                    | The SDK should be documented where the rest of the product already lives.          |
