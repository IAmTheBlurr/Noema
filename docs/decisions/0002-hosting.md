# ADR 0002: Firebase Hosting instead of App Hosting

- Status: Accepted
- Date: 2026-07-23

## Context

Firebase App Hosting was preferred, but its official framework matrix currently gives preconfigured, supported adapters only to Next.js and Angular. Other Node frameworks may work through community adapters or the output-bundle specification, without the same support guarantee.

## Decision

Use classic Firebase Hosting for the static SvelteKit client and second-generation Firebase Functions for trusted server work. Do not force SvelteKit SSR through an unsupported App Hosting path.

## Migration path

If Firebase publishes a supported SvelteKit App Hosting adapter, swap `adapter-static` for the supported adapter, add App Hosting configuration and Secret Manager bindings, and retain Auth, Firestore, Functions, domain contracts, and rules unchanged.
