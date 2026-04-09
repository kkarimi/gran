# Yazd Extraction TODO

North star: turn the PKM automation layer into `Yazd`, a source-agnostic local-first knowledge automation product, while keeping `Gran` focused on being the best Granola source app and plugin.

## Product Direction

- `Yazd` becomes the generic automation and publishing system.
- `Gran` stays the dedicated Granola app, source adapter, and local workspace.
- Gran automation should move toward plugin boundaries instead of growing deeper inside the Gran app core.
- Knowledge bases, review, and agent execution belong to `Yazd` over time.
- Keep the first extraction seams small, typed, and shippable.

## Guardrails

- Do not rename user-facing Gran features to Yazd prematurely.
- Do not split into separate repos yet.
- Keep `main` working after every slice: full QA, commit, and push. Hold releases until the extraction batch feels coherent.
- Prefer contract and package seams before moving behavior.
- Keep Gran usable even if Yazd packages are not installed.

| Priority | Status      | Size | Published In | Area                    | Task                                                                                                        | Why                                                               |
| -------- | ----------- | ---- | ------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| P1       | Done        | S    |              | Yazd / Strategy         | Lock the brand and architecture direction: Yazd as PKM automation core, Gran as a source app/plugin.        | The split should be intentional before code starts moving.        |
| P1       | Done        | M    |              | Yazd / Contract Package | Create `@kkarimi/yazd-core` with source, knowledge-base, and agent plugin contracts plus registry helpers.  | We need one clean seam before extracting real behavior.           |
| P1       | In Progress | M    |              | Gran / Source Seam      | Define how Gran surfaces meetings, transcripts, and sync events as a Yazd source plugin boundary.           | Gran should become one source, not the whole automation platform. |
| P1       | Pending     | M    |              | Yazd / KB Plugin Seam   | Move markdown vault and Obsidian-facing publish contracts behind Yazd knowledge-base plugin interfaces.     | Publishing should become source-agnostic.                         |
| P1       | Pending     | M    |              | SDK / Real Boundaries   | Make the SDK depend on extracted workspace packages instead of re-exporting root source directly.           | The SDK is not a real package boundary yet.                       |
| P1       | Pending     | M    |              | Gran / App Boundary     | Reduce Gran’s built-in automation ownership so it consumes Yazd-style contracts rather than inventing more. | This keeps Gran from staying the god-product forever.             |
| P2       | Pending     | M    |              | Yazd / Review Core      | Extract review and publish decision models into Yazd-facing core contracts.                                 | Review is central to the generic product.                         |
| P2       | Pending     | M    |              | Yazd / Pi Plugin        | Design a Pi/OpenClaw agent plugin package on top of the Yazd agent contract.                                | Pi support fits better as a Yazd ecosystem package.               |
| P2       | Pending     | M    |              | Yazd / KB Plugins       | Add second-wave knowledge-base plugins such as Notion, Capacities, or Tana on top of the shared contract.   | These should build on the generic KB seam, not custom Gran logic. |
| P3       | Pending     | M    |              | Docs / Product Story    | Reframe docs once behavior actually moves: Gran as source app, Yazd as PKM automation product.              | The public story should match the implementation, not get ahead.  |

## Recommended Build Order

1. Yazd contract package
2. Gran source seam
3. knowledge-base plugin seam
4. SDK real package boundaries
5. Gran app boundary cleanup
6. review core
7. Pi/OpenClaw plugin
8. second-wave knowledge-base plugins
