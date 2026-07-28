# CLAUDE.md

Project memory. Read this before writing or modifying any UI.

<!-- Add project-specific sections here: commands, stack, architecture. -->

## Audience

Single-user tool. The only reader is its author. He knows what the app does,
chose to build it, and already trusts it. He does not need to be sold, taught,
welcomed, reassured, or encouraged.

Never write for a prospective user, a first-time visitor, or an evaluator.
There are none and there will never be any.

## UI content: the one rule

**Every string in the interface must be a label, a value, or an error.**

- **Label** — names a control or region. 1-3 words. No sentence.
- **Value** — user data or system state.
- **Error** — what failed and what to do. Only on failure.

If a string is none of these, delete it. Do not rewrite it shorter. Delete it.

## UI content: never remove

These rules delete words and ornament. They never delete capability or
information. The following always survive:

- **Controls and features.** Inputs, buttons, search, filters, sort, navigation.
  This is a copy pass, not a scope pass. Never delete a control to satisfy a
  rule about text.
- **State and values.** Counts, totals, statuses, timestamps, selection,
  progress, results. The author knows what the app does. He does not know what
  it currently contains, and only the screen can tell him.
- **View identity.** Every screen names the view it is showing, in one word.
  A highlighted nav item alone is not sufficient.
- **Input identification.** Every input carries one word identifying it, as a
  label or a placeholder. One, not both. An unlabeled box is a puzzle.
- **Affordance indicators.** Disclosure chevrons, dropdown carets, required
  markers, loading states, focus states. These encode behavior no word
  replaces. Only *redundant* icons are prohibited: the `+` beside `Add`, the
  glyph beside a wordmark.
- **Empty regions.** Render the word `Empty`, or render nothing at all. Never
  render an empty container.

## UI content: never generate

In any form, under any justification:

- Taglines, slogans, mission statements, value propositions, hero copy
- Epigraphs, aphorisms, philosophy, poetry, any sentence with a "voice"
- Eyebrows and kickers (small-caps labels above headings)
- Section headings whose section is already obvious from position or content
- Helper text, hint text, or captions explaining a control that works
- Reassurance or trust copy about privacy, security, or data handling
- Empty-state prose. An empty region says `Empty` or shows nothing
- Onboarding, tips, tours, callouts, "get started" affordances
- Placeholder text that gives examples of what to type
- Confirmation prose beyond the state change itself
- Wordmarks, logos, product names, brand glyphs
- Decorative icons; icons paired with text that says the same thing
- Questions where a label belongs ("What would you like to add?" -> "Add")
- Invented verbs for standard actions. Use `Add`, `Save`, `Delete`, `Edit`
- Second person. No "you," "your," "let's," "we"
- Adjectives and adverbs anywhere in the chrome

## UI content: always

- Standard vocabulary over bespoke vocabulary, always.
- Shorten by deleting whole strings, never by truncating a needed one into a
  fragment. `OK · mock` is not a shorter label, it is a broken one. Any label
  that survives is a real word.
- Sentence case when writing text. This governs the words, not the CSS.
- One element, one job. Nothing does double duty.
- A control whose function is unambiguous from shape and position may carry
  no text at all.

## Check before emitting

Run on every string and every element, in order:

1. Delete it. Can the user still complete the task? If yes, it stays deleted.
2. Does it restate something true of the app in general, independent of this
   screen and its current data? Delete it. Knowing what the app does is not
   knowing what it currently contains, so never delete state on these grounds.
3. More than three words? Justify each word or cut to three.
4. Does it have a tone? Delete it. Interface text has no tone.

Applies to elements too, but only to elements that carry information:
decorative icons, badges, and any container whose sole contents were deleted
by the rules above. A container holding surviving content stays, with its
existing visual treatment intact.

## Do not touch

These rules govern content only: what exists on screen and what it says.

The visual language is settled and is not yours to revise. Do not change, and
do not propose changing:

- Color palette, background treatment, accent colors
- Typefaces, weights, type scale
- Border radius, borders, shadows, gradients, blurs
- Spacing, padding, margins, whitespace, layout density
- Transitions, animation, hover and focus effects
- Component shape and visual treatment

When these rules remove text from a component, keep the component's styling
exactly as it is and let it shrink. Do not restyle, recenter, rebalance, or
"clean up" what remains. Removing content is not license to redesign.

## Known failure mode

The default output of a language model asked for a "clean" or "minimal" UI is a
marketing landing page with generous whitespace and a serif headline. That is a
style, not restraint, and it is the exact failure being prohibited here.
Restraint is measured by count of elements, not by amount of space between them.

## When uncertain

Emit less. Ask. Never fill a gap with copy.
