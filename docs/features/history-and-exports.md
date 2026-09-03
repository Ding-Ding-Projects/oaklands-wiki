# Local history and exports

## Behaviour

Every creation, change and removal of visitor-owned state is recorded as a new
entry, in this browser only.

Entries record **what changed**, not that something did: "accent: #ffab5e to
#7fb2ff", never "Updated". An unchanged save records nothing, so the panel stays
a list of real events rather than a log of saves.

## Restoring is append-only

A restore adds a **new** entry rather than rewriting one. An undo can therefore
be undone, and that undo undone in turn. A restore that discards the branch it
replaces is the one failure that makes a history panel unsafe to open, because
you cannot experiment without risking the state you started from.

## Filtering

A date range, an action filter, and a text search with its own anchored
regular-expression builder. All three compose; none overrides another.

The action filter is **derived from the entries themselves** rather than
hard-coded, so a new kind of action appears automatically instead of being
missing from a list nobody remembered to update. Each action shows its count, so
an empty one is visibly empty rather than mysteriously absent.

## Bulk actions

Multi-select with an explicit scope. "Select all 12 matching" and "select all 340
entries" are **different buttons**, because leaving "all" to mean whichever the
reader assumed is how a bulk action surprises somebody. Inverse selection and
clear sit beside them.

## Exports

Eight formats that can carry a flat row set faithfully: JSON, JSON Lines, CSV,
TSV, Markdown, YAML, HTML and plain text. The export honours the active filter
and selection, so what downloads is what the panel shows.

Secrets are never included. Where an export omits something, it says so rather
than silently dropping a field.

## Failure modes

A history write never fails the operation it was recording. Storage that refuses
a write is reported rather than pretended.

## Suggested articles

- [The authenticator](authenticator.md)
- [The file converter](converter.md)
