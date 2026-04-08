---
name: gran
description: Use Gran to inspect Granola meetings, fetch notes and transcripts, work automation review queues, and export targeted meeting data.
metadata: { "openclaw": { "requires": { "anyBins": ["gran", "gran-toolkit"] } } }
---

# Gran 👵🏻

Use this skill when the user wants to:

- get meeting notes or transcripts from Granola
- inspect folders or search meetings
- review generated automation artefacts or recovery issues
- export notes or transcripts for a specific folder or meeting

## Command Selection

- Prefer `gran` when it exists in `PATH`.
- Fall back to `gran-toolkit` only when dealing with a legacy install.
- Prefer `--format json` whenever another agent step will parse the output.

Use this shell snippet at the start of a task:

```bash
if command -v gran >/dev/null 2>&1; then
  G=gran
else
  G=gran-toolkit
fi
```

## First Checks

1. Check auth before doing real work:

```bash
$G auth status
```

2. If the toolkit is not authenticated, ask the user to run one of:

```bash
$G auth login --api-key grn_...
$G auth login
```

3. Refresh local state before time-sensitive meeting queries:

```bash
$G sync
```

## Working Rules

- Use `meeting list --format json` or `search --format json` to discover meeting ids first.
- Use `meeting notes <id>` and `meeting transcript <id>` for single-meeting follow-up.
- Use `automation artefacts`, `automation runs`, and `automation health` for review and recovery tasks.
- Use folder-scoped exports when the user wants a batch export for one team, customer, or project.
- For “today”, “yesterday”, or date-range requests, list meetings as JSON and filter by `updatedAt` or `createdAt` in the agent layer.

## Common Tasks

### Get today’s meeting notes

1. Run:

```bash
$G meeting list --limit 50 --format json
```

2. Filter the returned meetings to the relevant date.
3. For each chosen id, run:

```bash
$G meeting notes <meeting-id> --format markdown
```

### Get today’s transcripts

1. Run:

```bash
$G meeting list --limit 50 --format json
```

2. Filter to today’s meetings.
3. For each chosen id, run:

```bash
$G meeting transcript <meeting-id> --format text
```

### Search for a meeting by topic, customer, or tag

```bash
$G search "customer onboarding" --format json
```

### Review generated note candidates

```bash
$G automation artefacts --kind notes --format json
$G automation approve-artefact <artefact-id> --note "Reviewed in OpenClaw"
$G automation reject-artefact <artefact-id> --note "Needs a tighter summary"
```

### Inspect automation health and recover failures

```bash
$G automation health --format json
$G automation recover <issue-id>
```

### Export a folder to local files

```bash
$G export --folder Team --output ./exports/team-archive
```

### Open one meeting in the local web workspace

```bash
$G meeting open <meeting-id> --open=false
```

## Notes

- The CLI already supports both API-key auth and desktop-session fallback.
- Review artefacts are durable; once you approve one, any approval-triggered automation actions may run immediately.
- Keep outputs machine-readable for downstream agent steps unless the user explicitly wants prose.

For more concrete command examples, see `references/cli-examples.md` next to this skill.
