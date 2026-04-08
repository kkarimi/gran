# CLI Examples

These examples assume the executable is available as `gran`. If you are dealing with an older
install that still only exposes `gran-toolkit`, substitute that name.

## Discovery

```bash
gran auth status
gran sync
gran folder list --format json
gran meeting list --limit 20 --format json
gran search "risk review" --format json
```

## Single Meeting

```bash
gran meeting view <meeting-id> --format json
gran meeting notes <meeting-id> --format markdown
gran meeting transcript <meeting-id> --format text
gran meeting export <meeting-id> --format json
```

## Review Queue

```bash
gran automation artefacts --kind notes --format json
gran automation runs --status pending --format json
gran automation approve-artefact <artefact-id> --note "Reviewed"
gran automation reject-artefact <artefact-id> --note "Needs a rewrite"
gran automation rerun <artefact-id>
gran automation health --format json
```

## Batch Exports

```bash
gran export --folder Team --output ./exports/team-archive
gran export --transcripts-only --output ./exports/all-transcripts
gran export --notes-only --format json --output ./exports/all-notes-json
```

## Browser / Workspace

```bash
gran web
gran meeting open <meeting-id> --open=false
gran tui
```
