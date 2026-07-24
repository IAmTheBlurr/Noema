# Life Corpus contributor guide

## Product invariants

- Capture requires only `rawText`; never add a mandatory classification field.
- Preserve human-authored text and append immutable events for meaningful changes.
- AI output stays separate from canonical entries and requires explicit acceptance.
- Every private document lives below `users/{uid}` and rules must enforce that boundary.
- Never log entry content, notes, prompts, or model responses by default.
- Never add an autonomous consequential action.

## Engineering conventions

- Use strict TypeScript without `any`.
- Keep domain types independent of Firebase SDK types.
- Use Svelte 5 runes and accessible semantic controls.
- Run `pnpm verify` before committing.
- Use the `demo-life-corpus` project for emulator work.
- Do not deploy or connect local development to a real Firebase project without explicit approval.
