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
- [ ] Site confirmed live by fetching the deployed URL and reading it back
- [ ] `build.bat` and `download-dependencies.bat`
- [ ] Vendored fonts with pinned versions and a SHA-256 manifest
- [ ] Corpus importer with robots preflight, and the full 1,066-article capture
- [ ] Line-count script with authorship attribution
- [ ] Release workflow

## Phase 2 — Articles

- [ ] Article routes prerendered for every imported article
- [ ] Wikitext and expanded HTML captured, sanitised, source chrome stripped
- [ ] Typed infobox extraction
- [ ] Redirects resolved; unresolved links render as honest plain text, never dead hrefs
- [ ] Attribution on every article: revision, contributors, timestamp, licence, source link
- [ ] GitHub wiki generator
- [ ] Wiki pushed *(blocked: the wiki repository does not exist until a first page is created through the web UI)*

## Phase 2.5 — Design

- [ ] Screens authored in the design workspace and checked into `design/`
- [ ] Design-reference renderer and per-screen parity inventory
- [ ] Parity guard proved red-then-green

## Phase 3 — The redesign

- [ ] Category browse with per-surface search and anchored regex builder
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
