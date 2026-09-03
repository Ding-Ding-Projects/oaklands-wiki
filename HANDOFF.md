# Handoff

**As of 2026-09-03.** Every claim here was checked against the repository and the live site
at the time of writing, not carried forward from a plan or from the previous handoff.

## Where it stands

Two surfaces, both live, both generated from one corpus so they cannot disagree:

- **Site** — `https://ding-ding-projects.github.io/oaklands-wiki/`
- **Wiki mirror** — `https://github.com/Ding-Ding-Projects/oaklands-wiki/wiki`

The completeness inventory stands at **34 of 34 rows built**. Each row names its
implementation, documentation and evidence, and the guard fails when any named artefact is
missing — which it did during this pass, on a documentation path that had been written into
a row before the file existed.

## What is genuinely done

| Area | State |
|---|---|
| Corpus capture, with a fail-closed robots preflight | 1,063 articles, wikitext + expanded HTML |
| Typed infobox extraction | 802 of 1,063 articles |
| Article pages, attribution, redirects, link integrity | Live; unresolved links render as plain text, never dead hrefs |
| Category browse + `/browse/` with composing filters | 63 categories; letter, category and type filters |
| Comparison tables from typed infobox records | 17 tables — a view the source cannot produce |
| Logic lab | Built from the wiki's own documented parts; bounded relaxation, so feedback loops settle rather than hang |
| Search with an anchored regex builder | Per-field state, plain text default, engine errors reported honestly |
| Archived media at display size | ~2,400 WebP, about 46 MB total |
| Vendored fonts | Inter and JetBrains Mono, 13 files, every weight and unicode-range subset, 278 KB |
| Settings surface | Language modes, funny levels, appearance, per-element editors, palette, notifications |
| Locks, ladder, School mode, narrator, schedules, history, exports, converter, authenticator | Built; see the inventory rows for each |
| No element at browser defaults | 68 styled, 11 deliberately inherited with reasons |
| GitHub wiki mirror | 1,130 pages, all 5,602 internal links resolve |
| Accessibility, measured on the built site | 40 surface/viewport combinations, all clean |
| Design references and source differentiation | 9 pinned reference screens, 9 differentiation rows with paired captures |
| Root build scripts | `build.bat`, `download-dependencies.bat`, both with `/s` |
| Release workflow | Timing, line counts, published-release verification |

## What is not done

- **A screen recording of the built site.** Captures exist; a recording does not. It is the
  one unticked item left on the roadmap.
- **Audio and video are not archived.** 41 referenced media files are audio or video and
  keep an honest placeholder. A 30 MB mp4 has no place in ordinary Git.
- **Contrast ratios are not computed.** Both themes were checked by eye against the token
  palette; no automated pass runs.
- **Screen-reader behaviour is not driven.** Names, roles and heading structure are asserted
  from the DOM, which is not the same as listening to a screen reader read the page.

Three roadmap items **changed approach** rather than being completed as written, and are
recorded that way in [ROADMAP.md](ROADMAP.md) with the reason: media ships as committed
display-size WebP rather than release-backed volumes, at one width rather than three, and
the design references are captured from the built site rather than authored ahead of it.

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
written, and again during this pass.

**CSS specificity beat the spacing rules, silently.** `.ok-prose p { margin: 0 }` is
(0,1,1); the `> * + *` rhythm rules are (0,1,0). Every paragraph gap measured exactly 0px
while both rules looked correct. Reading CSS cannot tell you which rule won — only the
running page can. Measure with `getBoundingClientRect`, do not review.

**Cache-bust every navigation in the site auditor.** Disabling the browser cache is not
enough: an edge serving stale HTML serves markup pointing at the previous CSS hash, so the
audit measures a build that is no longer deployed. This cost a full diagnostic pass —
defects fixed an hour earlier were reported as still present.

**A sticky bar in a full-page capture is not a defect.** `captureBeyondViewport` renders a
sticky element at its stuck viewport position, so it lands mid-image looking like it floats
over the content. Measure the real viewport before filing it.

**`readdir` per item is O(n²).** The media importer called it once per image to test for an
existing file and slowed to 42 images a minute, still falling. The work was never the
network. Read the directory once; with bounded concurrency it runs at about 110 a minute.

**Assert every scripted replacement, and prefer an exact-match editor over shell heredocs.**
The shell eats backslashes and template literals. Several edits this session reported no
match and were nearly missed because a syntax check still passed. One left the importer's
entry guard comparing `file://C:/…` against Node's `file:///C:/…`, so `main()` never ran: it
exited 0, printed nothing, and wrote no corpus. It happened again during this pass, on a
regex containing `\b`.

**Two copies of one tokenizer will silently disagree.** `scripts/lib/reserved-terms.mjs`
hashed phrases with an exported `tokenise()` while its scanner kept an inline copy of the
same pattern. Changing one left the other behind, so a needle was built one way and searched
for another. The symptom was a hit whose reported digest did not match the digest of the run
it claimed to have found — which reads as a hashing bug rather than a duplication bug.

**Splitting hyphens manufactures phrases the text never contained.** The same file's scanner
turned a URL slug into a two-word run and failed **all 1,130 wiki pages** on a phrase that
appears in none of them. Any word-run matcher over prose needs hyphens to join, and its
exclusion list needs to be derived through the same tokenizer rather than by substring —
comparing against raw characters is exactly what let this through.

**A guard that lists what it forbids has published it.** The wiki guard used to carry its
forbidden phrases in plaintext, in a public repository, which is the failure it exists to
prevent. It holds 63 one-way digests now. The trade is stated in the file: a digest set
cannot be reviewed by reading it, and a phrase absent from the set cannot be caught, so it
is a backstop against an accidental paste rather than a proof of sanitisation.

## Verification, and where the evidence lives

`npm run check:all` runs every guard; `npm run check:self-tests` breaks each one on purpose
and requires it to turn red, then green on restore. Method, figures and honest limits are in
[docs/delivery/verification.md](docs/delivery/verification.md). Evidence is under
`evidence/` and `design/reference/`, and both are digest-locked, so a capture that drifts
fails the guard rather than quietly becoming a picture of something else.

Nothing runs in CI by standing policy: the release workflow builds, packages and publishes,
and no code-quality verdict gates a release. Local suites run in the task that changes the
code. A release can therefore ship from a commit whose local checks would have failed.

## Next owner's first move

Two candidates, both small:

1. **The screen recording** — the last unticked roadmap item, and the only visible gap.
   Capture the application's own window on an off-screen desktop, never the monitor.
2. **Audio and video archiving**, if it is wanted at all. It needs a decision about where
   30 MB files live before it needs any code.
