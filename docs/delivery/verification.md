# Verification

Everything claimed about this site is measured on the deployed build. Reading a
stylesheet cannot tell you which rule won, whether a control is big enough to
press, or whether a button does anything — only the rendered page can, so every
figure below comes from driving the real site in a browser.

## How the site is driven

An isolated headless Edge on an off-screen desktop, spoken to over the Chrome
DevTools Protocol. The visible desktop, cursor and foreground application are
never touched.

Isolation is proved before anything is measured. `/json/list` must return
**exactly one** target, of `page` type, with a debugging socket. Finding one
acceptable target among several proves nothing — a restored tab or a synced
extension would mean the run is reading somebody's browsing session, so the
script refuses rather than picking the convenient entry. The profile is created
per run and deleted afterwards.

Two details that are load-bearing rather than incidental:

- **Every navigation is cache-busted with a per-run query.** Disabling the
  browser cache is not enough. An edge that serves stale HTML serves markup
  pointing at the *previous* CSS hash, so the audit measures a build that is no
  longer deployed and reports defects that were fixed an hour earlier. This
  happened during development and cost a full diagnostic pass.
- **Nothing in the injected audit returns a promise.** `Runtime.evaluate` with
  `awaitPromise` hangs indefinitely on this Node and Edge pair, and the hang
  looks exactly like a slow page rather than a stuck call.

## What is checked, and where

`scripts/verify-built-site.mjs` — 8 surfaces × 5 viewports = **40 combinations**.

| Surface | Route |
|---|---|
| Home | `/` |
| Browse | `/browse/` |
| Compare | `/compare/` |
| Logic lab | `/logic/` |
| Docs | `/docs/` |
| About | `/about/` |
| Article | `/wiki/Copper/` |
| Category | `/category/Ores/` |

| Viewport | Size | Scale |
|---|---|---|
| phone-narrow | 320 × 720 | 2 |
| phone | 390 × 844 | 2 |
| tablet | 768 × 1024 | 2 |
| desktop | 1280 × 900 | 1 |
| desktop-200pct | 1280 × 900 | 2 |

Each combination asserts:

1. **The page body never scrolls sideways.** `scrollWidth` against
   `clientWidth` on the document element.
2. **Which element overflows**, separately from whether the page does. An
   element can overflow its own box without its right edge passing the viewport,
   so every element is scanned for `scrollWidth > clientWidth` with a visible
   overflow. An earlier version compared right edges and confidently named the
   wrong culprit — a floating toolbar that had merely been *pushed* out — while
   the real cause was a paragraph containing an unbreakable 24-character
   snapshot id.
3. **Touch-target size.** Every control at least 24 CSS px in both directions.
   Inline links inside flowing text are exempt, because enlarging them would
   break the line box they sit in; a standalone control that merely happens to be
   small is not exempt.
4. **Accessible names.** Every link, button, input, select and textarea has a
   name from its text, `aria-label`, `title` or an associated label.
5. **Alt text** present on every image.
6. **Exactly one `h1`**, and no heading level skipped by more than one.
7. **Reading measure**, computed from the rendered prose column and the real
   body font size rather than asserted from the stylesheet.
8. **A visible focus indicator** on the first focusable control.

## Current result

```
checked 40 surface/viewport combinations
  horizontal overflow : 0
  unnamed controls    : 0
  images without alt  : 0
  h1 count not 1      : 0
  targets under 24px  : 0
  elements overflowing: 0
```

Full per-combination output, including the measured prose width and approximate
character count for every surface, is retained at
`evidence/verification/accessibility.json`.

## Design reference and differentiation

`scripts/capture-evidence.mjs` captures two sets from the same isolated browser:

- **Nine reference screens** under pinned tuples into `design/reference/`, each
  digest-locked in `design/parity-inventory.json`.
- **Differentiation pairs** — the same article from this site and from the
  source wiki at one identical tuple (390 × 844, scale 2, mobile), into
  `evidence/differentiation/`.

`scripts/check-parity.mjs` fails closed when a reference row has an incomplete
tuple, a missing capture, or a capture whose digest has drifted, and when a
differentiation row lacks its counter-treatment or its paired evidence. Its
`--self-test` proves it bites by removing one field at a time; all eight
mutations turn it red and the unmutated inventories turn it green.

## Guards, and why each is watched failing

A guard nobody has watched fail is decoration, so each one is broken on purpose,
seen red, restored, and seen green. Every guard here has a `--self-test` that
does exactly that.

| Guard | What it refuses |
|---|---|
| `check-static-bundle.mjs` | A missing base path, any remote asset, injected `<style>`, absent OG tags, an article count that has drifted, an embed graphic that is not byte-identical to its root master, a token declared twice, or a `dist/` older than its sources |
| `check-elements.mjs` | A required element absent from the built markup |
| `check-completeness.mjs` | A feature row without its implementation, docs, or evidence |
| `check-parity.mjs` | A reference screen or differentiation pair that is missing, incomplete, or has drifted |
| `check-wiki.mjs` | A corpus article with no generated wiki page |

The completeness guard earned its keep during this pass: the three closing rows
were written with a docs path that did not exist yet, and it refused the
inventory until the file was written. That is the whole point of naming
artefacts rather than describing them.

## What is not verified here

- **Nothing runs in CI.** By standing policy no tests, lint, or type checks run
  in the release workflow, and nothing gates a release on a code-quality
  verdict. The suites in this repository run locally in the task that changes
  the code and their real results are reported; they never block a build. The
  cost is stated plainly: a release can ship from a commit whose local checks
  would have failed.
- **Contrast ratios are not computed.** Both themes were checked by eye against
  the token palette; no automated contrast pass runs yet.
- **Screen-reader behaviour is not driven.** Accessible names, roles and heading
  structure are asserted from the DOM, which is not the same as listening to a
  screen reader read the page.
