# Data model

## Entry

Path: `users/{uid}/entries/{entryId}`

Fields: `ownerId`, `rawText`, nullable `url`, nullable `money { amount, currency }`, nullable `notes`, nullable `timeHorizon`, `status`, `recurrenceCount`, authoritative `createdAt` and `updatedAt`, nullable `archivedAt` and `trashedAt`, and `schemaVersion: 1`.

## Event

Path: `users/{uid}/entries/{entryId}/events/{eventId}`

Events are append-only and contain `ownerId`, `entryId`, `type`, authoritative `occurredAt`, `schemaVersion: 1`, and optional non-sensitive `changedFields`. Implemented types are created, edited, resurfaced, archived, restored, trashed, and restored from trash.

## Interpretation seam

`users/{uid}/entries/{entryId}/interpretations/{interpretationId}` is reserved and denied by current rules. A future record must include source IDs, provider/model metadata, prompt-template version, assumptions, claims, creation time, and approval state. It must never replace `rawText`.

Money uses a Firestore number for the approximate display amount in Phase 1. Exact accounting values will require a decimal/minor-unit migration before financial-record modules exist.

Schema changes increment `schemaVersion` and use an explicit, resumable migration rather than opportunistic client rewrites.
