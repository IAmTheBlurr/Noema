# Noema

A private, capture-first personal corpus. Freeform entries remain canonical while optional capability blocks support life events, standing records, recurring commitments, and derived views.

## What works

- Google sign-in in production and anonymous emulator-only local access
- Thought, Life Event, Standing Record, and Recurring Commitment capture intents
- Optional URL, integer-minor-unit money, notes, temporal uncertainty, standing details, and recurrence details
- Life Events with best-known reverse chronology and an Unplaced section
- Current salary, pay frequency, rent, monthly recurring totals, and missing-value state
- Subscription filtering across active, possible, ended, unknown, verification, amount, and cadence state
- Needs Verification discovery for uncertainty, incomplete financial records, and conflicting current records
- Editing with append-only lifecycle and structured-change events
- Archive, restore, trash, and recursive permanent deletion
- Full local ZIP export with canonical JSONL, readable Markdown, history, and derived JSON views
- Bounded live inbox search over the latest 500 entries
- Responsive keyboard-accessible layouts for desktop, iPhone, and iPad
- Typed mock and Genkit/Gemini adapters behind a protected developer action

## Start locally

Prerequisites: Node.js 22.23.1, pnpm 11.9.0, and Java 21 or newer.

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The app uses the safe `demo-life-corpus` Firebase project and connects Auth, Firestore, Functions, and Hosting to local emulators.

## Verify

```powershell
pnpm check
pnpm lint
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm build
pnpm verify
```

Java is required for the rules and browser suites because both use Firebase emulators.

## Architecture

The static SvelteKit client subscribes directly to private Firestore collections. Security Rules are the authorization boundary. Batches and transactions keep entry changes and immutable events together. A callable Function is the only permanent-deletion path.

All entries share one substrate. `captureIntent` is a noncanonical hint; optional `temporal`, `standingRecord`, and `recurrence` blocks enable several capabilities on one record. Generated views are pure client projections. Schema v1 entries are normalized lazily and remain readable without a bulk migration.

Export reads the complete entry collection and event subcollections, builds canonical and derived files in memory, and downloads an uncompressed UTF-8 ZIP. No export content is sent to a new backend.

## Documentation

- [Product doctrine](docs/product-doctrine.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Export format](docs/export-format.md)
- [Security](docs/security.md)
- [Local development](docs/local-development.md)
- [Deployment](docs/deployment.md)
- [Roadmap](docs/roadmap.md)
- [Shared substrate ADR](docs/decisions/0004-entry-substrate.md)

## Current limits

The live interface subscribes to the latest 500 entries; full export is not limited. Money is stored at a fixed 1/100 currency-unit scale and currencies are never converted. Generated monthly values are estimates rounded to the nearest minor unit. Automatic classification, automatic date inference, imports, reminders, notifications, graphical timelines, recommendations, and autonomous financial actions remain deferred.
