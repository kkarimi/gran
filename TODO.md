# Plugin Architecture TODO

North star: make plugins feel like a real loaded capability system, not a pair of special-case toggles with plugin-shaped names.

## Refactor Guardrails

- Keep built-in plugins working while making the system generic.
- Prefer registries, generic state, and generic transport shapes before adding any new plugin surface area.
- Prefer capability checks over plugin-id checks in feature code; only the registry and compatibility layer should care about concrete shipped ids.
- Keep `main` shippable after every slice: full QA, commit, and push, but no release cut yet.

| Priority | Status | Size | Published In | Area                               | Task                                                                                                                                  | Why                                                                                           |
| -------- | ------ | ---- | ------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P1       | Done   | M    |              | Plugins / Registry + State         | Add a real plugin registry, make persisted plugin settings generic, and derive app plugin state from a loaded plugin list.            | The current plugin layer is hardcoded around `automation` and `markdown-viewer` everywhere.   |
| P1       | Done   | M    |              | Plugins / Transport + Server       | Make plugin routes and client transport generic so the server can accept any shipped plugin id from the registry.                     | The server currently whitelists plugin ids in route code, which defeats the point of plugins. |
| P1       | Done   | L    |              | Plugins / Web Settings + Selectors | Render plugins from a list in Settings and move plugin feature checks behind helper selectors instead of direct shape assumptions.    | The browser still assumes `plugins.automation` and `plugins.markdownViewer` exist as fields.  |
| P2       | Done   | M    |              | Plugins / Config Compatibility     | Keep old config/env keys working, but internally normalise plugin enablement into a generic map that future plugins can extend.       | We need to simplify internals without breaking current users.                                 |
| P2       | Done   | M    |              | Plugins / Capability Boundaries    | Replace ad hoc feature gating with a small set of shared plugin/capability helpers for automation, markdown rendering, and later UIs. | Feature code should ask for capabilities through one seam, not reimplement plugin lookups.    |
| P3       | Done   | S    |              | Docs / Plugin Notes                | Write concise notes on how shipped plugins are declared, enabled, persisted, and exposed across CLI/server/web.                       | The next plugin work should land on deliberate boundaries instead of rediscovering them.      |
