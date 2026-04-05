# CLI Examples

These examples assume the executable is available as `granola`. If the environment only has
`granola-toolkit`, substitute that name.

## Discovery

```bash
granola auth status
granola sync
granola folder list --format json
granola meeting list --limit 20 --format json
granola search "risk review" --format json
```

## Single Meeting

```bash
granola meeting view <meeting-id> --format json
granola meeting notes <meeting-id> --format markdown
granola meeting transcript <meeting-id> --format text
granola meeting export <meeting-id> --format json
```

## Review Queue

```bash
granola automation artefacts --kind notes --format json
granola automation runs --status pending --format json
granola automation approve-artefact <artefact-id> --note "Reviewed"
granola automation reject-artefact <artefact-id> --note "Needs a rewrite"
granola automation rerun <artefact-id>
granola automation health --format json
```

## Batch Exports

```bash
granola notes --folder Team --output ./exports/team-notes
granola transcripts --folder Team --output ./exports/team-transcripts
granola notes --format json --output ./exports/all-notes-json
```

## Browser / Workspace

```bash
granola web
granola meeting open <meeting-id> --open=false
granola tui
```
