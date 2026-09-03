# Design language — Oaklands Reader

## Why Material Design 3 is not used here

The shared agent instructions require full Material Design 3 conformance for every
user-facing app and page. **This repository deliberately deviates from that rule**, at the
project owner's explicit direction on **2026-09-03**. It is recorded here so the gap reads
as a decision rather than an oversight.

The reason: Material Design 3 is application chrome. Tonal surface stacking, elevation,
floating action buttons and navigation rails are tuned for touch application interaction,
and they compete with long-form reading. This site is a reference work whose entire reason
for existing is that the source wiki is hard to read. Adopting an app design language would
have reproduced the problem in a nicer palette.

One system governs everything here — reading surfaces and app-shaped surfaces such as
settings, the command palette and the tab strip alike — so the product never visibly
changes design language mid-session.

## The system

**Typography is the system.** Body text is 18px on a phone and 19px on a desktop, at a line
height of 1.7, with the prose column capped near 70 characters. Headings use a display
serif on a ~1.25 modular scale with tight leading, so structure is legible at a glance
rather than announced by colour.

**Chrome recedes.** A calm paper reading surface, no elevation theatre, no floating action
button, no tonal layer stack. Structure is carried by rules, spacing and type weight rather
than filled containers. On phones the primary navigation sits within thumb reach at the
bottom of the viewport.

**Reference objects read differently from prose, on purpose.** Key facts cards and
comparison tables are material to look things up in rather than to read through, so they
take a denser, deliberately tabular treatment with tabular lining numerals and aligned
units. The visual break between "read this" and "look this up" is the point.

**Colour carries meaning, not decoration.** A restrained neutral base with a single accent,
plus category identity accents drawn from the real material tones in the game — copper,
oak, steel, slate. These are small identity marks, never large fills. Colour is never the
only signal for a state; text or shape always accompanies it.

**Density is the reader's choice**, alongside theme, fonts and per-element appearance.

## No element renders at browser defaults

The site emits no generic HTML. Every element it can produce gets a deliberate treatment in
`src/styles/elements.css` — 65 of them, from `<sup>` and `<abbr>` through `<table>`,
`<details>`, `<input type="range">` and `<meter>`.

This matters more here than in a typical site, because most of those elements do not come
from hand-written markup at all: they arrive inside imported wiki HTML. An unstyled
`<blockquote>` or `<dl>` on one article out of a thousand looks to a reader exactly like the
stylesheet failed to load, and nobody previews a thousand articles.

Eleven elements are **deliberately left to inherit**, each with its reason recorded in the
guard rather than silently skipped — `<div>` and `<span>` have no default appearance to
override, `<br>` has no box, and `<tbody>` is a row-grouping box whose rows carry the
striping and whose cells carry the borders. Styling it directly would be a no-op written
only to satisfy a check, which is worse than an honest exemption.

`scripts/check-elements.mjs` enforces this against a **hand-written list**. A guard that
collected the selectors already present and checked they were well-formed would pass cleanly
on a stylesheet that styles nothing — it never looks for what is missing. It also requires a
**bare type selector**: when it was first run it correctly refused `<thead>` and `<tbody>`,
which had only descendant rules like `thead th`. A rule about a child is not a rule about the
element, and that distinction is exactly what an existence check normally gets wrong.

## Enforcement

`src/styles/tokens.css` is the only file permitted to declare `--ok-*` custom properties,
and no token may be declared twice inside one selector block. Both rules are asserted by
`scripts/check-static-bundle.mjs` against the built output.

A token declared in two places is decided by import order rather than by intent, so editing
the losing copy is a silent no-op: it type-checks, formats, builds and ships without
changing a single pixel. That failure is invisible in review, which is why it is a guard
rather than a convention.

Both assertions have been observed failing on purpose and passing again on restore. A guard
nobody has watched fail proves nothing.

## Suggested articles

- [Delivery and build scripts](../delivery/README.md)
- [Import source policy](../import/source-policy.md)
