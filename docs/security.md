# Security

- All corpus paths are nested beneath a Firebase UID.
- Rules deny unauthenticated access, cross-user access, owner reassignment, schema downgrade, event mutation, interpretation access, and direct entry deletion.
- Rules accept legacy schema v1 documents and validate schema v2 intent, temporal, standing, recurrence, currency, counter, lifecycle, and timestamp shapes.
- Permanent deletion is an authenticated callable that verifies ownership and trashed state before recursive deletion.
- The local app uses only `demo-life-corpus` and connects every Firebase SDK to localhost emulators.
- Firebase Web configuration is public client configuration. Production values belong in an ignored local environment file or build environment.
- Gemini secrets remain server-only Secret Manager values.
- Entry content, notes, prompts, export contents, and AI responses are not logged.
- Full export is generated locally in the browser and contains no authentication token, Firebase secret, or internal security metadata.
- Analytics, ads, and production telemetry are absent.

Before production deployment, verify Google sign-in, authorized domains, App Check policy, Firestore region, retention/export policy, and least-privilege IAM.
