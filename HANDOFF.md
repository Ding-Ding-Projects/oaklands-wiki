# Handoff

**As of 2026-09-03.** Every claim here was checked against the repository and the live site
at the time of writing, not carried forward from a plan.

## Where it stands

Two surfaces, both live, both generated from one corpus so they cannot disagree:

- **Site** — `https://ding-ding-projects.github.io/oaklands-wiki/`
- **Wiki mirror** — `https://github.com/Ding-Ding-Projects/oaklands-wiki/wiki`

The archive itself is complete: **1,063 articles**, 63 categories, 90 redirects resolved,
357 editors credited, and archived images at display size. What remains open is the wider
settings surface, not the content.

## What is genuinely done

| Area | State |
|---|---|
| Corpus capture, with a fail-closed robots preflight | 1,063 articles, wikitext + expanded HTML |
| Typed infobox extraction | 802 of 1,063 articles |
| Article pages, attribution, redirects, link integrity | Live; 1,024 unresolved links render as plain text, never dead hrefs |
| Category browse + `/browse/` with composing filters | 63 categories; letter, category and type filters |
| Search with an anchored regex builder | Per-field state, plain text default, engine errors reported honestly |
| Archived media at display size | ~2,400 images, WebP, roughly 25 KB each |
| Oaklands Reader v2 design | Dark-first, image-forward, theme control on every page |
| No element at browser defaults | 65 styled, 11 deliberately inherited with reasons |
| GitHub wiki mirror | 1,130 pages, all 5,602 internal links resolve |
| Root build scripts | `build.bat`, `download-dependencies.bat`, both with `/s` |
| Release workflow | Timing, line counts, published-release verification |

## What is not done

Everything in Phases 4–6 of [ROADMAP.md](ROADMAP.md): language modes, funny-level controls,
per-element appearance editing, the command palette, toy locks and the unlock ladder,
scheduled settings, attention modes, local history, exports, the file converter and the
authenticator. The completeness inventory tracks each as an open row; an open row is
expected to be unbuilt and does not fail the guard, while a `built` row missing any named
artefact does.

**Audio and video are not archived.** 41 referenced media files are audio or video and keep
an honest placeholder; a 30 MB mp4 has no place in ordinary Git, and the release-backed
volumes for those are still open.

## Things that will waste your time if you rediscover them

**Do not use the global `fetch` against the source.** Node's undici gets HTTP 403 on
`oaklands.fandom.com/robots.txt` while `node:https` and `curl` both get 200 with an
identical user agent. It is refused the *policy file* while being served the API normally,
so a fetch-based importer concludes it is blocked by a source that explicitly permits it —
and the tempting next step is a `--skip-robots` override, the wrong fix to a misread
problem. Detail in [docs/import/source-policy.md](docs/import/source-policy.md).

**Four article pairs differ only in capitalisation.** `Acid staff` and `Acid Staff` are
different pages on the wiki and the same path on a case-insensitive filesystem. Before this
was handled the build reported 1,063 and wrote 1,059 — nothing failed, four articles simply
showed another article's content. The lowest page id keeps the plain slug; a coverage guard
now compares the index against the built directories.

**A guard will validate a stale `dist`.** A failed `vite build` leaves the previous output
in place, so every assertion passes against an artifact that no longer matches the tree.
There is a freshness check now; it went red on a real stale build within seconds of being
written.

**CSS specificity beat the spacing rules, silently.** `.ok-prose p { margin: 0 }` is
(0,1,1); the `> * + *` rhythm rules are (0,1,0). Every paragraph gap measured exactly 0px
while both rules looked correct. Reading CSS cannot tell you which rule won — only the
running page can. Measure with `getBoundingClientRect`, do not review.

**A sticky bar in a full-page capture is not a defect.** `captureBeyondViewport` renders a
sticky element at its stuck viewport position, so it lands mid-image looking like it floats
over the content. Measure the real viewport before filing it.

**`readdir` per item is O(n²).** The media importer called it once per image to test for an
existing file and slowed to 42 images a minute, still falling. The work was never the
network. Read the directory once; with bounded concurrency it runs at about 110 a minute.

**Assert every scripted replacement.** Several edits this session reported no match and were
nearly missed because a syntax check still passed. One left the importer's entry guard
comparing `file://C:/…` against Node's `file:///C:/…`, so `main()` never ran: it exited 0,
printed nothing, and wrote no corpus. Prefer an exact-match editor over shell heredocs for
anything containing backslashes or template literals — the shell eats both.

## Next owner's first move

Phase 4. The pieces are independent, so any of them is a reasonable start; the settings
surface itself is the prerequisite for most, since language modes, funny levels, appearance
and attention modes all need somewhere to live.
