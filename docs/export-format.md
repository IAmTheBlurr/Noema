# Export format

The Export control builds a local UTF-8 ZIP:

```text
noema-export-YYYY-MM-DD/
  manifest.json
  entries.jsonl
  entry-events.jsonl
  corpus.md
  views/
    life-events.json
    standing-records.json
    recurring-commitments.json
    subscriptions.json
    current-financial-baseline.json
    unverified-records.json
```

`entries.jsonl` and `entry-events.jsonl` are canonical. Each line is one valid JSON object and files are sorted deterministically. Dates and timestamps use ISO strings. Stable IDs, owner IDs, raw human text, structured capability blocks, lifecycle state, schema versions, and event history are preserved.

`manifest.json` records export schema version, timestamp, app version, optional commit identifier, and counts. `corpus.md` is a readable corpus representation. Files beneath `views/` are disposable projections and can be regenerated from canonical entries.

The ZIP uses the standard stored method without compression. This keeps the browser implementation small and portable. Authentication tokens, Firebase configuration, server secrets, and internal authorization metadata are excluded.
