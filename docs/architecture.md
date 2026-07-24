# Architecture

The SvelteKit application is a static, responsive client. Firebase Authentication establishes identity. A Firestore repository subscribes to `users/{uid}/entries` and maps SDK timestamps into domain dates. Search is a bounded in-memory service over the signed-in user's loaded entries.

Client mutations use Firestore batches or transactions to update an entry and append its immutable event together. Direct client deletion is denied. An authenticated callable performs recursive server-side deletion so nested private data cannot be orphaned.

The AI boundary is a small `AiService` contract with mock and Genkit adapters. Phase 1 exposes only a developer-gated reflection preview. AI data is never merged into an entry.

Future bounded perspectives are configuration and evidence scopes, not autonomous agents. A perspective will declare purpose, allowed record selectors, constraints, claims, provenance, communication permissions, state, and a human-controlled authority ceiling. It can read only records explicitly in scope and can emit only reviewable interpretations.
