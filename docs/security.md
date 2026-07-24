# Security

- All corpus paths are nested beneath a Firebase UID.
- Rules deny unauthenticated access, cross-user access, owner reassignment, event mutation, interpretation access, and direct entry deletion.
- Rules validate allowed fields, sizes, statuses, currency shape, counters, and authoritative timestamps.
- Permanent deletion is an authenticated callable that verifies ownership and recursively deletes the entry tree.
- The local app uses only `demo-life-corpus` and explicitly connects every SDK to localhost emulators.
- Gemini secrets are server-only Firebase Secret Manager values.
- Entry content, notes, prompts, and responses are not logged.
- Analytics, ads, and production telemetry are absent.

Before production launch, enable Google sign-in, configure authorized domains, enable App Check for callable functions, choose a Firestore region, set a retention/export policy, and review least-privilege IAM. App Check is intentionally not enforced in emulator-first Phase 1.
