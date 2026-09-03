# Search

There is a search field in the top bar of **every page** — all 2,053 of them —
and a full search surface at `/search/` behind it.

## Why the master field is a plain form

It is a `<form method="get">` with no JavaScript, on purpose.

Most of this site is prerendered static HTML that never hydrates. The thousand
article pages carry no React at all, because hydrating them would ship a bundle
to re-render markup that is already correct, a thousand times over. A search box
that needed script to submit would therefore be **decoration on the majority of
the site** — it would look identical and do nothing.

A form submits with Enter, with a click, with a screen reader, and with the
bundle blocked. It reaches `/search/?q=…`, and that page is where the real search
lives.

## What is in the index

Everything, because a search that covers only part of a site teaches people not
to trust it. A miss has to mean "not here", not "not in the part we indexed".

| Kind | Count |
|---|---:|
| Articles | 1,063 |
| Files | 836 |
| Alternate names | 83 |
| Categories | 63 |
| Standing pages | 8 |
| **Total** | **2,053** |

**549KB, 119KB gzipped**, fetched once and only on the search page. Article
bodies are deliberately excluded — full text would be several megabytes for a
search most people use to find a page by name. What is indexed is the title, a
short summary, the categories, and the infobox values, because an island, a price
or a status is what people actually search an item for.

## Ranking

Searching `copper` should not bury the Copper article under forty files whose
names contain it. Results score:

| Match | Score |
|---|---:|
| Title is exactly the query | 1000 |
| Title starts with it | 800 |
| Title contains it | 600 |
| Summary contains it | 300 |
| Matched somewhere else | 100 |

Kind breaks the remaining ties — an article outranks a file — and a shorter title
containing the query is treated as the more specific page.

## The search page

- Its own field with the **anchored regex builder**, plain text by default and
  regex an explicit opt-in.
- Filters by kind, each showing its count. Turning the last one off is refused:
  a filter that can never match reads as a broken search rather than an empty one.
- The query stays in the address bar, so a result set can be linked to or
  reloaded.
- Honest states throughout: loading, no query yet, no results, and index failed
  to load — which says so and points at Browse, which carries its own list and is
  unaffected.

## Other search fields

This is the master search, not the only one. Every collection surface keeps its
own field with its own anchored builder and its own isolated state: Browse, each
category page, Compare, the docs, the settings panel, the command palette, and
the money guide. Two fields on one surface never share state.

## Verification

`npm run build:search` regenerates the index and refuses to write an empty one.
It also refuses two entries sharing a URL, which would otherwise show up as a
repeated result rather than as an error.
