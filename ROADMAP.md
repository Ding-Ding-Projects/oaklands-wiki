# Roadmap

Ticked only when genuinely finished — implemented, verified, and where it claims something
visible, captured from the real built site. Work that is written but unverified stays
unticked with its state named beside it.

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
- [ ] Vendored fonts with pinned versions and a SHA-256 manifest
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

## Phase 2.5 — Design

- [ ] Screens authored in the design workspace and checked into `design/`
- [ ] Design-reference renderer and per-screen parity inventory
- [ ] Parity guard proved red-then-green

## Phase 3 — The redesign

- [x] Oaklands Reader v2: dark-first, image-forward, modern (replaced the editorial v1)
- [x] Theme control that works on every page, including the script-free article pages
- [x] `/browse/` over all 1,063 articles: letter, category and type filters that compose
- [x] Archived media at display size, with an honest empty state where the archive holds none

- [x] Category browse with per-surface search and anchored regex builder
- [ ] Article reader: Key facts card, sticky contents, containers that scroll instead of the body
- [ ] Comparison tables built from typed infobox records
- [ ] Left-docked tab strip with correct vertical orientation and arrow keys
- [ ] Source-differentiation rows closed by side-by-side captures

## Phase 4 — Surface contract, part A

- [ ] English, Cantonese and bilingual language modes
- [ ] Both per-language funny-level sliders, and the dialog emoji switch
- [ ] Appearance system: theme, density, fonts, per-element editors, infinite colour picker
- [ ] Command palette on `Ctrl+Shift+F` with exact-element teleport
- [ ] Non-blocking notifications and a reviewable centre
- [ ] Accessibility and responsive sizing verified at 320px and 100–200% scale

## Phase 5 — Surface contract, part B

- [ ] Per-element toy locks, the unlock ladder, and Support Tickets
- [ ] School mode with rename, and the shared unlock credential
- [ ] Narrator with per-language voice pickers, rate and pitch
- [ ] Scheduled settings, attention modes, local history, exports, bulk actions
- [ ] File converter, local authenticator, personal-vocabulary upload, Ollama boundary

## Phase 6 — Media and release

- [ ] Media published as release-backed volumes with verified round trips
- [ ] Display variants at 320/640/1280, never upscaled
- [ ] Real captures and a screen recording from the built site
- [ ] Offline documentation, changelog viewer, status surface registration
- [ ] First tagged release with line counts, timing and a code name

## Deliberately not doing

- **`build-installer.bat`** — this repository ships a website and no installed application.
  Recorded in [docs/delivery/README.md](docs/delivery/README.md).
- **Material Design 3** — deliberately superseded by Oaklands Reader. Recorded in
  [docs/standards/design-language.md](docs/standards/design-language.md).
