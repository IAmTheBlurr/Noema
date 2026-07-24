# Life Corpus

A private, capture-first personal life operating system. Phase 1 makes a thought safe to forget: sign in, preserve the original wording in seconds, add optional context, retrieve it later, and keep an inspectable history when it resurfaces or changes.

## What works

- Emulator-only local vault and production-directed Google sign-in
- Freeform capture with no required classification
- Optional URL, approximate money, currency, notes, and time horizon
- Live reverse-chronological inbox
- Editing with append-only events
- Resurfacing count and visible recurrence history
- Archive, restore, trash, and confirmed recursive permanent deletion
- Bounded, normalized client-side search over the latest 500 entries
- Responsive keyboard-accessible UI with system light/dark themes and reduced-motion support
- Typed mock and Genkit/Gemini AI adapters behind a protected developer action
- Auth, Firestore, Functions, Hosting, and Emulator Suite configuration
- Firestore isolation tests, unit tests, and a full Playwright lifecycle test

## Start locally

Prerequisites: Node.js 22.23.1, pnpm 11.9.0, and Java 21+.

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) and choose **Enter local vault**. Emulator UI is at [http://127.0.0.1:4000](http://127.0.0.1:4000).

`pnpm dev` is the single local-system command. It builds Functions and runs the Svelte app with Auth, Firestore, Functions, and Hosting emulators using the safe `demo-life-corpus` project. No production credential is needed.

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

`pnpm verify` runs type checking, formatting/linting, unit tests, rules tests, the critical browser flow, Functions compilation, and the production build.

## Architecture at a glance

The static SvelteKit client uses Firebase Auth and subscribes directly to private Firestore collections. Rules are the authorization boundary. Batches and transactions keep entry mutations and immutable events together. A callable Function is the only permanent-deletion path and recursively removes subcollections.

AI is isolated in Functions behind an `AiService` contract. Local use selects a deterministic mock. The real implementation uses Firebase Genkit and Google AI with a Secret Manager value. Reflections are previews and are never persisted or merged into the canonical entry.

Firebase App Hosting is not selected because its [official framework support](https://firebase.google.com/docs/app-hosting/frameworks-tooling) still provides first-party adapters only for Next.js and Angular. The static client uses Firebase Hosting; Functions host trusted work. See [ADR 0002](docs/decisions/0002-hosting.md).

## Versions

The foundation was resolved on 2026-07-23:

- Node.js 22.23.1 and pnpm 11.9.0
- Svelte 5.56.7 and SvelteKit 2.70.1
- TypeScript 6.0.3 and Vite 8.1.5
- Tailwind CSS 4.3.3 and Skeleton 5.0.0
- Firebase Web SDK 12.16.0 and Firebase CLI 15.24.0
- Firebase Functions 6.6.0 and Admin SDK 13.10.0
- Genkit 1.40.1 and `@genkit-ai/google-genai` 1.40.1
- Vitest 4.1.10 and Playwright 1.61.1

Cloud Functions deploy with the officially supported Node.js 22 runtime. See Firebase's [runtime guidance](https://firebase.google.com/docs/functions/manage-functions#set_node.js_version).

## Documentation

- [Vision](docs/vision.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Security](docs/security.md)
- [Local development](docs/local-development.md)
- [Deployment preparation](docs/deployment.md)
- [Roadmap](docs/roadmap.md)
- [Stack ADR](docs/decisions/0001-stack.md)
- [Hosting ADR](docs/decisions/0002-hosting.md)
- [AI ADR](docs/decisions/0003-ai.md)

## Production setup

No live deployment is performed. Before one, create a Blaze-plan Firebase project, register the Web app, enable Google Auth, create Firestore, set `GEMINI_API_KEY` with Firebase Secret Manager, provide the public Firebase build variables, disable emulator mode, enable App Check, review regions/IAM, and explicitly deploy rules, Functions, and Hosting. Detailed steps are in [deployment preparation](docs/deployment.md).

## Current limits

Search is local and capped at 500 loaded entries. Money is an approximate number, not an accounting decimal. There are no reminders, uploads, voice capture, imports, tax/debt workflows, recommendations, or autonomous actions. App Check is documented but not enforced in emulator-first Phase 1. The real Gemini adapter is present but disabled until a server-side secret and explicit provider flag are supplied.
