# Architecture

## Client

Noema is a static SvelteKit application. Firebase Authentication establishes identity. `FirestoreEntryRepository` subscribes to `users/{uid}/entries`, normalizes schema v1 and v2 documents into one domain model, and maps Firestore timestamps to dates.

The main screen owns authentication, navigation, live entries, editor state, and export orchestration. Capture and edit forms share the same intent-aware field component. Life Events, Financial Baseline, Subscriptions, and Needs Verification are client-side projections over canonical entries.

## Persistence

Client mutations use Firestore batches or transactions:

- create writes an entry and created event together;
- edit upgrades the touched entry to schema v2 and appends relevant human or structured-change events;
- repeat increments the count transactionally and appends an event;
- lifecycle changes update the entry and append an event.

Direct client deletion is denied. An authenticated callable verifies ownership and trashed state, then recursively deletes the entry tree so event subcollections are not orphaned.

## Compatibility

No bulk migration runs. Missing `captureIntent` normalizes to `thought`. Legacy `{ amount, currency }` money normalizes to integer `{ minorUnits, currency }`. Missing capability blocks normalize to `null`. A legacy document is written as schema v2 only when edited.

## Projections

Projection functions are pure and tested:

- Life Events separates usable structured dates from Unplaced events.
- Current standing selection prefers the latest effective start, then the latest update.
- Monthly recurrence normalization supports weekly, biweekly, semimonthly, monthly, quarterly, and yearly cadence.
- Financial totals exclude income and transfers and never combine currencies.
- Verification discovery includes uncertain status, uncertain active state, missing recurring values, unresolved time, missing standing starts, and conflicting current subjects.

## Export

Export deliberately bypasses the 500-entry live subscription limit. It loads all entries and all event subcollections, sorts them deterministically, creates canonical and derived UTF-8 files, and builds a local stored ZIP. Authentication tokens, Firebase configuration, secrets, and internal authorization metadata are not serialized.

## AI boundary

The AI boundary remains a small `AiService` contract with mock and Genkit adapters. This increment adds no automatic classification or date inference. AI preview data is never merged into canonical entries.
