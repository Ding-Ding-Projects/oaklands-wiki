# Handoff

**As of 2026-09-03, commit on `main` after the Phase 1 close.** Every claim here was checked
against the repository and the live site at the time of writing, not carried forward from a
plan.

## Where it stands

The Day Teet Hui is **live and verified** at
`https://ding-ding-projects.github.io/oaklands-wiki/`. Home and About both return 200, the
Open Graph tags are present in the served markup, and the embed graphic fetches anonymously
at 47,688 bytes matching the repository-root master byte for byte.

The site is **deliberately thin and says so on its own front page**. Category counts are
real and freshly captured; the articles behind them are imported to disk but not yet
rendered, so nothing on the site links through to an article yet.

## What is genuinely done

| Area | State |
|---|---|
| Repository, Pages, Discussions, Projects | Created and enabled |
| Oaklands Reader design system | Built, single guarded token source |
| Home and About, prerendered | Built and live |
| Build provenance on every surface | Built — version, commit, build time with timezone |
| Open Graph embed graphic | Built, both copies proved identical |
| Corpus importer with robots preflight | Built, live verdict is a plain allow |
| Full corpus capture | 1,063 articles, 90 redirects, 98 categories, 357 editors |
| Built-output guard | 6 assertions, each proved red-then-green |
| Completeness inventory guard | 6 mutations, all proved caught by `--self-test` |

## What is not done

Everything in Phase 2 onward in [ROADMAP.md](ROADMAP.md). Specifically still open inside
Phase 1: `build.bat`, `download-dependencies.bat`, vendored fonts with a SHA-256 manifest,
the line-count script, and the release workflow. The completeness inventory holds 6 rows
`built` and 26 `open`; an open row is expected to be unbuilt and does not fail the guard,
but a `built` row missing any named artefact does.

## Blocked

**The GitHub wiki mirror cannot be pushed yet.** `has_wiki` is true, but the wiki repository
does not exist until somebody creates a first page through the web UI at
`github.com/Ding-Ding-Projects/oaklands-wiki/wiki`. There is no REST or `gh` route for it —
this was confirmed against sibling repositories, where one has `has_wiki: true` and no
`.wiki.git`, and another has a real wiki on branch `master`. Nothing else depends on it.

## Things that will waste your time if you rediscover them

**Do not use the global `fetch` against the source.** Node's undici gets HTTP 403 on
`oaklands.fandom.com/robots.txt` while `node:https` and `curl` both get 200 with an
identical user agent. It is a client fingerprint, not the request, and `curl --http1.1` also
gets 200 so it is not the HTTP version. The trap is that undici is refused the *policy file*
while being served the API normally, so a fetch-based importer concludes it is blocked by a
source that explicitly permits it — and the tempting next step is a `--skip-robots`
override, which would be the wrong fix to a misread problem. Full detail in
[docs/import/source-policy.md](docs/import/source-policy.md).

**A sticky element in a full-page capture looks like a layout defect and is not.** With
`Page.captureScreenshot({ captureBeyondViewport: true })`, a `position: sticky` bar renders
at its stuck viewport position, which lands mid-image in a tall capture and reads exactly
like a bar floating over the content. Measure the real viewport before filing it.

**The bundle guard used to validate a stale `dist`.** A failed `vite build` leaves the
previous output in place, so every assertion passed against an artifact that no longer
matched the tree — a green run describing a build that had already failed. There is now a
freshness check that refuses a `dist` older than the sources; it went red on a real stale
build within seconds of being written.

**Assert every scripted replacement.** Two edits in this session reported no match and were
almost missed because a syntax check still passed afterwards. One of them left the importer's
entry guard comparing `file://C:/…` against Node's `file:///C:/…`, so `main()` never ran: the
importer exited 0, printed nothing, and wrote no corpus. Silent success is the expensive
failure mode.

## Next owner's first move

Phase 2: render article routes from the captured corpus. The corpus is on disk under
`data/corpus/<snapshotId>/` with `articles.json` carrying wikitext, `revid`, `timestamp`,
`user` and categories per page — enough for real attribution. Note the importer captures
wikitext only so far; the plan calls for `action=parse` expanded HTML as well, because the
`{{Ore}}` and `{{Wood}}` templates are not worth re-implementing.
