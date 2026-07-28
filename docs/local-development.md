# Local development

## Prerequisites

- Node.js 22.23.1
- pnpm 11.9.0
- Java 21 or newer
- Chromium installed through Playwright

## Start

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open `http://127.0.0.1:5173`. The local sign-in creates an anonymous emulator identity. Auth, Firestore, Functions, and Hosting connect only to localhost under `demo-life-corpus`. The Emulator Suite UI is at `http://127.0.0.1:4000`.

No production credential is required. Copy `.env.example` only to override safe defaults. Never put a Gemini key in a browser environment variable.

## Verify

```powershell
pnpm check
pnpm lint
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm functions:build
pnpm build
pnpm verify
```

Rules and browser tests start Firebase emulators and therefore fail immediately when Java is unavailable. The repository declares Node 22; other Node majors emit an engine warning and are not the deployment target.
