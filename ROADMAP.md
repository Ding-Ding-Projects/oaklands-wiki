# Roadmap

Ticked only when genuinely finished — implemented, verified, and where it claims something
visible, captured from the real built site. Work that is written but unverified stays
unticked with its state named beside it. Where an approach changed, the original item moves
to **Changed approach** with the reason rather than being ticked or quietly deleted.

Each item corresponds to a row in [`data/inventories/completeness.json`](data/inventories/completeness.json),
which fails closed on any row without its implementation, documentation and evidence.
Current state: **34 of 34 rows built**.

## Phase 1 — Foundation and hosting

- [x] Public repository created with wiki, Discussions and Projects enabled
- [x] Oaklands Reader design tokens, in a single guarded source file
- [x] Reading-first base layer: capped measure, thumb-reach bottom nav, no sideways body scroll
- [x] Home and About routes, prerendered to static HTML
- [x] Real category index captured from the live API (1,066 articles, 3,355 media files)
- [x] Build provenance — version, commit and build time bound to the artifact
- [x] Open Graph embed graphic, generated from the design tokens, root master and served copy proved byte-identical
- [x] Built-output guard: base path, remote assets, injected CSS, Open Graph, token scope
- [x] Every guard assertion proved red-then-green
- [x] Pages workflow
- [x] Site confirmed live by fetching the deployed URL and reading it back
- [x] `build.bat` and `download-dependencies.bat`, both with `/s`
- [x] Vendored fonts with pinned versions and a SHA-256 manifest — 13 files across Inter and
      JetBrains Mono, every weight and every `unicode-range` subset the upstream returned,
      278KB, guarded by `check-fonts` and proved red-then-green
- [x] Corpus importer with a fail-closed robots preflight (live verdict: allow)
- [x] Full corpus captured — 1,063 articles, 90 redirects, 98 categories, 357 editors
- [x] Line-count script with per-surviving-line authorship attribution
- [x] Phone rendering measured on the live site at 390x844: no horizontal overflow, 18px/1.7 body, 56px category cards, 55px nav targets
- [x] Release workflow with timing, line counts and published-release verification

## Phase 2 — Articles

- [x] Article routes prerendered for every imported article
- [x] Wikitext and expanded HTML captured, sanitised, source chrome stripped
- [x] Typed infobox extraction (802 of 1,063 articles)
- [x] Redirects resolved; unresolved links render as honest plain text, never dead hrefs
- [x] Attribution on every article: revision, contributors, timestamp, licence, source link
- [x] GitHub wiki generator, with a coverage and link-integrity guard
- [x] Wiki pushed — 1,130 pages live, all 5,602 internal links resolve

## Phase 2.5 — Design reference

- [x] Nine reference screens checked into `design/`, each pinned to a complete tuple
      (route, state, theme, viewport, scale) and digest-locked
- [x] Per-screen parity inventory at [`design/parity-inventory.json`](design/parity-inventory.json)
- [x] Parity guard proved red-then-green — eight mutations, each caught

## Phase 3 — The redesign

- [x] Oaklands Reader v2: dark-first, image-forward, modern (replaced the editorial v1)
- [x] Theme control that works on every page, including the script-free article pages
- [x] `/browse/` over all 1,063 articles: letter, category and type filters that compose
- [x] Archived media at display size, with an honest empty state where the archive holds none
- [x] Category browse with per-surface search and anchored regex builder
- [x] Article reader: Key facts card, sticky contents, containers that scroll instead of the body
- [x] Comparison tables built from typed infobox records — 17 tables
- [x] Left-docked tab strip with correct vertical orientation and arrow keys
- [x] Source-differentiation rows closed by side-by-side captures — nine rows, each with its
      paired capture at one identical tuple

## Phase 4 — Surface contract, part A

- [x] English, Cantonese and bilingual language modes
- [x] Both per-language funny-level sliders, and the dialog emoji switch
- [x] Appearance system: theme, density, fonts, per-element editors, continuous colour picker
- [x] Command palette on `Ctrl+Shift+F` with rich inline setting controls
- [x] Non-blocking notifications and a reviewable centre
- [x] Accessibility and responsive sizing verified at 320px and 100–200% scale — 40
      surface/viewport combinations, all clean

## Phase 5 — Surface contract, part B

- [x] Per-element toy locks, the unlock ladder, and Support Tickets
- [x] School mode with rename, and the shared unlock credential
- [x] Narrator with per-language voice pickers, rate and pitch
- [x] Scheduled settings, attention modes, local history, exports, bulk actions
- [x] File converter, local authenticator, personal-vocabulary upload, Ollama boundary

## Phase 6 — Media and release

- [x] Archived media committed at display size — 2,386 WebP thumbnails, about 46MB
- [x] Real captures from the built site — nine reference screens plus four differentiation captures
- [x] Offline documentation, changelog viewer with commit links, status surface
- [x] Tagged releases with line counts, timing and a dim sum code name
- [ ] **Screen recording of the built site** — not done. Captures exist; a recording does not.

## Extras beyond the original plan

- [x] Logic simulator built from the wiki's own documented parts, with a bounded relaxation
      evaluator so feedback loops settle rather than hang
- [x] No element renders at browser defaults — 68 elements styled, 11 deliberately inherited,
      each recorded with its reason

## Changed approach

Recorded rather than ticked, because the original item is not what shipped.

- **Media as release-backed asset volumes.** Superseded by committed display-size WebP
  thumbnails. The source's own thumbnailer returns WebP at about 400px, which is the size
  the design actually renders, so the whole set is 46MB rather than the ~1.6GB the originals
  would have cost. That fits in ordinary Git, needs no release plumbing, and removes a whole
  class of "the asset volume did not publish" failure. The originals are not archived.
- **Display variants at 320/640/1280.** Not built. One 400px-wide variant is shipped instead,
  for the reason above. A phone and a desktop therefore receive the same file; at the sizes
  this design renders images, the saving from a second variant would be small.
- **Screens authored in a separate design workspace.** The reference bundle is captured from
  the real built site instead of authored ahead of it. Capturing the artifact that actually
  ships removes the gap between an approved design and a deployed one, which is the gap
  parity checking exists to close — but it does mean the references cannot catch a design
  the build never attempted. Stated so it reads as a decision rather than an oversight.

## Deliberately not doing

- **`build-installer.bat`** — this repository ships a website and no installed application.
  Recorded in [docs/delivery/README.md](docs/delivery/README.md).
- **Material Design 3** — deliberately superseded by Oaklands Reader. Recorded in
  [docs/standards/design-language.md](docs/standards/design-language.md).
- **Tests and lint in CI** — standing policy: the release workflow builds, packages and
  publishes, and no code-quality verdict gates a release. Local suites run in the task that
  changes the code. Recorded in [docs/delivery/verification.md](docs/delivery/verification.md).
