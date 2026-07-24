# ADR 0001: SvelteKit static client with Firebase services

- Status: Accepted
- Date: 2026-07-23

## Decision

Use Svelte 5, SvelteKit 2, strict TypeScript, Tailwind CSS 4, Skeleton 5, the Firebase modular Web SDK, Cloud Firestore, Firebase Authentication, and second-generation Cloud Functions. Build the browser app with `adapter-static` and serve it as a single-page application from Firebase Hosting.

## Rationale

Phase 1 is an authenticated client application whose data authorization is enforced by Firestore Rules. Static hosting avoids an unnecessary application server while Functions provide the narrow trusted boundary for recursive deletion and AI. Domain types and service interfaces keep Firebase details replaceable.

## Consequences

The app does not depend on SSR. Loading and authentication states are handled in the client. Production Firebase configuration is supplied at build time; local development defaults to a demo project and emulators.
