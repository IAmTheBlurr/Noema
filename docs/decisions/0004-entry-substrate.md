# ADR 0004: Shared entry substrate

Status: accepted

## Context

Life events, standing facts, and recurring obligations need different optional structure, but separate record systems would make capture rigid, duplicate real-world facts, and fragment history.

## Decision

All records remain entries. `captureIntent` is a noncanonical hint that controls initial form presentation. Temporal, standing, and recurrence capability blocks are independently optional. Generated views query and project those blocks without becoming sources of truth.

Temporal uncertainty is first-class: raw language, optional bounds, precision, source, confidence seam, and review state remain distinct. Standing values preserve history through ended records and successor records rather than destructive replacement.

Schema v1 is normalized at read time. Only an edited legacy entry upgrades to schema v2.

## Consequences

- Rent can be both a standing fact and recurring commitment on one entry.
- Incomplete records remain valid and appear in Needs Verification.
- Generated views can evolve without migrating canonical data.
- Form and rule validation are more detailed, but capture still requires only freeform text.
- Future inference must remain an explicit interpretation until accepted by the author.
