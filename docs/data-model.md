# Data model

## Entry

Path: `users/{uid}/entries/{entryId}`

Schema v2 retains the original substrate:

- identity: `ownerId`
- canonical text: `rawText`
- hint: `captureIntent`
- shared optional values: `url`, `money`, `notes`, `timeHorizon`
- optional capabilities: `temporal`, `standingRecord`, `recurrence`
- lifecycle: `status`, `recurrenceCount`, timestamps
- compatibility: `schemaVersion`

`captureIntent` is one of `thought`, `life-event`, `standing-record`, or `recurring-commitment`. It selects the initial capture experience but does not own or constrain capability blocks.

Money is `{ minorUnits: integer, currency: ISO-like three-letter code }`. No currency conversion occurs. Schema v1 `{ amount, currency }` values remain readable.

## Temporal expression

`temporal` preserves optional `rawText`, `earliest`, `latest`, `precision`, `source`, optional `confidence`, and `reviewedByUser`. Date-only bounds are ISO `YYYY-MM-DD` strings and never pass through timezone conversion.

Precision supports exact, day, month, season, year, range, relative, and unknown. Source supports human, future LLM inference, document-derived, and system-derived interpretations. The current interface writes only human source values.

## Standing record

`standingRecord` may include subject hint, value text, effective start and end expressions, verification status, and current/ended/unknown state. Subject hints are operational selectors for generated views, not canonical categories.

Changing a stable fact should end the old record and create a successor. Editing does not destructively rewrite event history.

## Recurrence

`recurrence` may include kind, cadence, interval, due text, effective start and end, verification, active state, auto-renew state, payment source text, cancellation URL, and last known charge.

The shared entry-level money value supplies the amount for standing and recurring capabilities on the same record. This prevents rent from requiring duplicate records or duplicate amount fields.

## Event

Path: `users/{uid}/entries/{entryId}/events/{eventId}`

Events are append-only. Existing lifecycle types remain, with added intent, temporal, standing, recurrence, verification, ended, and reactivated types. Human-authored revisions preserve raw text and common optional fields. Structured events record changed field names without duplicating complete private capability blocks.

## Compatibility

Schema v1 documents need no migration. Read normalization supplies thought intent and absent capability blocks. Editing upgrades only the touched document. Export preserves each record's stored schema version.

## Interpretation seam

`users/{uid}/entries/{entryId}/interpretations/{interpretationId}` remains reserved and denied. Future inferred values must retain provider, model, prompt version, source IDs, confidence, assumptions, and approval state without replacing human-authored fields.
