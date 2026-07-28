# Deployment

Noema uses Firebase Hosting, Cloud Firestore, Authentication, and callable Functions. Firebase App Hosting is not selected because the existing static SvelteKit path is already established.

## Configuration

1. Use the existing Firebase project; do not create a second project.
2. Register the Web app and enable Google Authentication.
3. Create Firestore in the selected region.
4. Set `GEMINI_API_KEY` only if the optional Gemini developer adapter is enabled.
5. Supply production `PUBLIC_FIREBASE_*` values through the build environment.
6. Set `PUBLIC_USE_FIREBASE_EMULATORS=false`.
7. Keep `PUBLIC_ENABLE_AI_DEV_TOOLS=false` for normal production.

## Verify and deploy

```powershell
pnpm verify
pnpm build
pnpm firebase deploy --only firestore:rules,functions,hosting
```

No composite Firestore index is required by this increment. The app orders only within entry and event collections using single fields.

Deployment must use an already authenticated Firebase CLI and the repository's configured project alias. Billing, paid-service enablement, regions, IAM, and Authentication providers are not changed automatically.
