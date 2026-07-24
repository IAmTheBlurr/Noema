# Local development

## Prerequisites

- Node.js 24.11.1
- pnpm 11.9.0
- Java 21 or newer for Firebase emulators

## Start

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

`pnpm dev` builds Functions, then starts Auth, Firestore, Functions, Hosting emulators and the Svelte development server. Open `http://127.0.0.1:5173`. Choose **Enter local vault**. The clearly marked local path creates an anonymous emulator-only identity and never contacts production.

The Emulator Suite UI is at `http://127.0.0.1:4000`.

No `.env` file or production credential is required. Copy `.env.example` only to override safe defaults. Never put a Gemini key in a browser environment variable.

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
