# Deployment preparation

No deployment is performed by this repository setup.

## Firebase Console

1. Create a Firebase project on the Blaze plan.
2. Register a Web app and enable Google Authentication.
3. Create Firestore in the chosen region.
4. Set the Functions secret with `pnpm firebase functions:secrets:set GEMINI_API_KEY`.
5. Replace the demo public Firebase values in the build environment and set `PUBLIC_USE_FIREBASE_EMULATORS=false`.
6. Optionally set `PUBLIC_AI_PROVIDER=gemini` and `PUBLIC_ENABLE_AI_DEV_TOOLS=true` for a non-production connectivity environment. Keep developer tools disabled in normal production.
7. Review rules and indexes, then deploy explicitly with Firebase CLI only after approval.

The selected path is Firebase Hosting plus Functions because App Hosting does not currently offer first-party SvelteKit support. See ADR 0002.
