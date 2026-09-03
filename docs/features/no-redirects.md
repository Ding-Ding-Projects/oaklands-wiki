# No redirects: every destination is a page here

The source wiki sends you elsewhere in three different ways, and each one left a
hole in this archive. All three are pages now.

Before this change **1,970 internal links across the corpus went nowhere** and
rendered as plain text. Afterwards, **16 do** — and those sixteen are the source
wiki's own machinery, which genuinely has no equivalent here.

| Link kind | Occurrences | Was | Is now |
|---|---:|---|---|
| `Category:…` | 885 | plain text | the category page, which already existed |
| `File:…` | 891 | plain text | a page for that file |
| `Template:… Nav` | 178 | plain text | the category the navigation box lists |
| Alternate names | — | followed silently to the target | a page of their own |
| `Special:` `User:` `Module:` | 16 | plain text | still plain text, on purpose |

## Alternate names are pages, not redirects

The source carries 90 titles that redirect somewhere else. Following a redirect
at link-rewrite time made the name itself unreachable: you clicked `Blue pine`,
you arrived at `Blue Pine`, and nothing recorded that the name you asked for
existed at all.

Each is a page here, carrying the same content under its own address, with a
line at the top saying which article it is another name for. **83 of the 90** got
one; the remaining seven point at a category or at a source project page, and
those resolve to the category rather than becoming an article.

**The content is duplicated on purpose.** A thin page reading "see over there" is
a redirect with extra steps. A `<link rel="canonical">` points at the primary
article so a search engine treats the pair as one page — which is the correct
tool for this, where an HTTP redirect is not.

### The collision this exposed

20 alternate names differ from a real article only in capitalisation — `Blue
pine` beside `Blue Pine`, `Lost woods` beside `Lost Woods`. On a case-insensitive
filesystem those are **the same directory**, so the second page written silently
replaces the first.

This is the identical fault that once made the build report 1,063 articles while
writing 1,059 pages, with nothing failing and four articles quietly showing
another article's content. Alternate names now go through the same disambiguation
as articles, numbered after them so no existing article URL moves, and a guard
asserts that no two entries in the whole index share a slug.

## File pages

891 links pointed at a file description page. **836 files** have one now: the
archived image at display size, the articles that use it, and — for the 9 whose
image is not archived — an honest statement of that rather than a broken image.

A gap in the archive and a fault in the site deserve to look different.

## Templates resolve to categories

All eight navigation templates in the corpus (`Ore Nav`, `Locations Nav`, `NPC
Nav` and the rest) name a category that already has a page. The navigation box
itself is a source-wiki construct with no place in a reading-first archive; the
category page is what it was pointing readers at.

## What stays plain text, and why

Sixteen link occurrences remain unresolved:

- `Special:WhatLinksHere/…` — a query against the source wiki's own database.
- `Special:Upload` — a form for editing a wiki this is not.
- `User:…` — seven contributor pages on the source wiki.
- `Module:Changelog` — source wiki Lua.

These are not missing pages. They are the source's machinery, and a static
archive has no equivalent to point at. They render as plain text rather than as
a link that goes nowhere, and that is deliberate rather than unfinished.

## Verification

`npm run check:wiki` asserts every internal link in the wiki mirror resolves —
6,646 of them at the time of writing. `scripts/check-static-bundle.mjs` asserts
the built page count matches the index. `scripts/build-articles.mjs` prints the
unresolved count on every run, so a regression shows up as that number rising.
