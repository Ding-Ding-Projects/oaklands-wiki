# Delivery

## Build scripts

`build.bat` and `download-dependencies.bat` sit at the repository root, both accepting `/s`
for a silent, non-interactive run that exits non-zero on the first real failure.

**There is deliberately no `build-installer.bat`.** The shared instructions require one for
every installed application; this repository ships a website and no installed application,
so there is no installer to build. The exemption is recorded here rather than left as a
silent gap. If a desktop wrapper is ever added, that script becomes required in the same
change.

## Hosting

The site is published to GitHub Pages at
`https://ding-ding-projects.github.io/oaklands-wiki/` by `.github/workflows/pages.yml` on
every push to `main`.

The base path is configurable through `SITE_BASE` and defaults to `/oaklands-wiki/`. A
hardcoded root base deploys green and then 404s every asset, so
`scripts/check-static-bundle.mjs` asserts the prefix is present in the built HTML rather
than trusting the configuration that produced it.

## What CI does not do

No tests, lint, type checks or static analysis run in GitHub Actions, by standing policy.
The two checks the workflow does run are build-output assertions, not code-quality gates:
they fail only when the produced artifact is itself wrong. Local suites still run in the
task that changes the code, and their real results are reported; they simply never gate a
deploy.

## Suggested articles

- [Design language](../standards/design-language.md)
- [Import source policy](../import/source-policy.md)
