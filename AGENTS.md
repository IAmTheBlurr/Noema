# AGENTS.md

Instructions for coding agents working in this repository.

## Context

This is a private, single-user application whose author is its primary audience.
Optimize for the author's current needs. Do not add marketing or onboarding by
default, but treat the audience as context rather than a permanent constraint.

## Duty of care

- Understand the request and inspect the current state before changing it.
- Preserve user intent, data, functionality, and unrelated work.
- Prefer scoped, comprehensible, and reversible changes.
- Surface consequential assumptions, risks, and uncertainty.
- Verify work in proportion to its impact and report results honestly.

## Product and interface

- Preserve capabilities and relevant system state when changing content or
  presentation.
- Use clear, conventional, and precise language.
- Give controls accessible names and make important states perceptible,
  including selection, progress, loading, focus, and failure.
- Make errors identify the failure and a useful recovery action when one
  exists.
- Remove content or ornament only when it contributes no useful information,
  orientation, or interaction.
- Keep components focused. Follow the established visual language unless the
  task calls for a design change.
- Keep copy changes, behavior changes, and visual redesigns within the requested
  scope.

## Engineering

- Prefer the smallest coherent solution that fits the existing architecture and
  conventions.
- Favor readable, maintainable, and type-safe code with clear boundaries.
- Validate untrusted input and handle expected failure paths.
- Add or upgrade dependencies only when the benefit justifies the cost and
  compatibility risk.

## Data, security, and privacy

- Use least privilege and keep secrets out of source, logs, and client-visible
  output.
- Avoid logging private content when operational metadata is sufficient.
- Treat destructive operations and schema changes carefully. Preserve
  compatibility or provide a migration and recovery path.

## Verification and delivery

- Test changed behavior and likely regressions. Broaden verification as risk
  increases.
- Inspect the final diff and repository status before committing or delivering.
- Update documentation when a change would otherwise make it inaccurate.
- Before deployment, confirm the target, configuration, build, and required
  checks. Report any unverified area or external blocker.

## Version control

- Commit every agent-authored change before delivery.
- Keep each commit atomic: one coherent concern, with independent changes split
  into separate commits.
- Use a concise, semantically useful subject line and a message body that
  records intent, scope, and significant context.
- Inspect the staged diff before committing. Do not include unrelated user
  changes.

## When uncertain

Investigate first. Ask when a material choice cannot be resolved safely from the
repository and request. Do not invent requirements to fill a gap.
