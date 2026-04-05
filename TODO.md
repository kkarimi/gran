# V1 Launch TODO

Previous completed roadmap: `V1-RELEASE-TODO.md`.

North star: make `granola-toolkit` feel like a calm, service-backed product that a real user can install, connect, and trust on day one. The remaining v1 gap is not raw capability; it is whether the durable background runtime, guided setup, and browser UX actually feel coherent under first-run use.

## V1 Launch Guardrails

- Treat the reusable background service as the default local runtime, not a side path.
- Keep onboarding focused on the shortest route to value: API key, import, AI choice, starter pipeline.
- Avoid adding more panels before the default browser flow is calm enough to explain itself.
- Surface service and sync state explicitly so the user understands what keeps running.
- Add browser E2E coverage for the real first-run flow before calling the UX “v1 ready”.
- Keep shipping small slices with the full QA matrix and published versions recorded here.

| Priority | Status  | Size | Published In | Area                                    | Task                                                                                                                                                   | Why                                                                                                   |
| -------- | ------- | ---- | ------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| P1       | Done    | M    | 0.66.0       | Runtime / Service-First Web             | Make `granola web` attach to or start the reusable background service by default, with a clear foreground/debug escape hatch.                          | The default browser path should warm the local sync engine instead of creating another throwaway run. |
| P1       | Done    | M    | 0.66.0       | Web / Guided Setup V2                   | Refocus the onboarding flow into a cleaner three-step setup with explicit service context, better copy, and clearer next actions.                      | The current setup technically exists, but it still feels noisy and accidental in real use.            |
| P1       | Done    | M    | 0.66.0       | Testing / Service-Backed Onboarding E2E | Add or upgrade browser coverage for the actual happy path: launch, connect with an API key, sync/import, choose an agent, create the starter pipeline. | V1 confidence needs a real user journey, not just component checks and partial browser assertions.    |
| P2       | Pending | L    |              | Web / Home Dashboard                    | Add a calmer post-setup landing that surfaces sync health, recent meetings, background-service status, and starter automation before advanced panels.  | Users should land in one coherent home view instead of a dense wall of controls.                      |
| P2       | Pending | M    |              | Sync / Health + Recovery                | Improve sync health language, cadence visibility, stale-state warnings, and recovery suggestions in the browser and CLI.                               | A background process only builds trust if users can tell whether it is healthy.                       |
| P2       | Pending | M    |              | Auth / Provider Setup Polish            | Tighten API-key and AI-provider setup copy, missing-key detection, and fallback guidance for OpenRouter, OpenAI, Codex, and desktop import.            | First-run setup still leaks too much implementation detail into the UI.                               |

Status note:
The remaining work is productisation of the default path: make the background service the expected runtime, make setup feel guided, and make the browser land in a calmer place.
