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

## The system (v2)

The first version of this design was a book-like editorial system: display serif,
generous measure, quiet chrome. It was legible, and it read as a *document*. At the
owner's direction it was replaced with something that reads as *software*.

**Dark by default, light on request.** A theme control sits in the header and is applied
before first paint, so a returning visitor never sees the wrong theme flash. Depth comes
from one soft ambient shadow plus a light top edge, not from a stack of tonal greys.

**One variable sans throughout**, at 17px with a 1.65 line height, and a wide heading scale
so a page opens with a confident headline rather than a modest one. Negative tracking on
large type, none on small.

**Image-forward.** Category and article tiles carry real archived art at a display size.
Where the archive holds no image, a tile shows a letterform — never a broken image tag,
because a fault in the site and a gap in the archive deserve to look different.

**What survived from v1, because it was right:** a capped reading measure, real type
hierarchy, colour that carries meaning rather than decorating, and category identity taken
from the game's own material tones — copper, oak, steel, slate.

**Reference objects still read differently from prose.** Key facts cards and comparison
tables use tabular lining numerals and aligned units. The break between "read this" and
"look this up" is the point, and it survived the redesign intact.

**Density is the reader's choice**, alongside theme and the wider appearance controls.

## The theme control is not a React component

Article pages ship no JavaScript bundle at all — they are static text, and sending 200 KB
to re-render markup that is already correct is pure cost, a thousand times over. A
React-driven theme toggle would therefore render on those pages as a button that does
nothing, which is precisely the decorative-control defect these rules forbid elsewhere.

It is about a kilobyte of inline script instead: it applies the stored theme before paint
and wires the button, on all 1,129 pages, with no bundle required.

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
