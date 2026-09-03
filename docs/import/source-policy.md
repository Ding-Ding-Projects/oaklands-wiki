# Source policy and capture

## Behavior

`scripts/import-oaklands.mjs` reads `robots.txt` before any corpus request. It requires
HTTP 200 with `text/plain`, parses the applicable group for this importer's user agent,
applies the longest matching rule to `/api.php?action=query`, and records the verdict with
the matched rule and a SHA-256 of the policy response. It records the licensing page digest
before capture as well.

**There is deliberately no override flag.** A challenge page, a non-200, an unparseable
policy or a disallow ends the run. This source does not need one, and adding a bypass
"just in case" would mean the check could always be walked past.

## Configuration

| | |
|---|---|
| Source | `https://oaklands.fandom.com` |
| API | `https://oaklands.fandom.com/api.php` |
| User agent | `OaklandsWikiCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/oaklands-wiki)` |
| `maxlag` | 5 seconds |
| Pacing | 300 ms between requests |
| Maximum attempts | 5, with backoff on 429 and 503 |
| Response ceiling | 48 MiB, enforced while streaming |
| Redirects | rejected, never followed |

## The verdict this source actually gives

Measured 2026-09-03. The `User-agent: *` group carries an explicit
`Allow: /api.php?action=`, so the longest matching rule for our target is an **allow**:

```
robots: live verdict ALLOW via group "*" rule "Allow: /api.php?action="
```

Two details worth keeping:

- **`ClaudeBot` is `Disallow: /` on this host.** The importer's user agent must not resemble
  it. Borrowing a disallowed agent's name would turn a permitted request into a forbidden
  one, and the `*` group is what actually applies to us.
- Article `/wiki/` paths carry no blanket allow for `*`. The importer only ever touches
  `/api.php`, so this does not arise — but it is the reason not to "just scrape the pages"
  if the API ever becomes inconvenient.

## Why the importer does not use the global `fetch`

It uses `node:https`. This is not a style preference, and the reason is worth recording
because the failure is confusing and points the wrong way.

Measured against this source on 2026-09-03, with an **identical user agent and headers**:

| Client | `/robots.txt` | `/api.php?action=…` |
|---|---|---|
| Node global `fetch` (undici) | **HTTP 403** | HTTP 200 |
| `node:https` | HTTP 200 | HTTP 200 |
| `curl` (HTTP/1.1 and default) | HTTP 200 | HTTP 200 |

It is a client fingerprint at the edge, not anything about the request — `curl --http1.1`
gets 200, so it is not the HTTP version either.

The consequence is what makes it dangerous rather than merely annoying: undici is refused
**the policy file specifically**, while being served the API normally. An importer built on
`fetch` therefore sees a 403 on `robots.txt`, correctly refuses to proceed without a policy
verdict, and reports that the source is blocking it — on a source that in fact explicitly
permits exactly what it wants to do. The obvious next step from there is to add a
`--skip-robots` override, which would be the wrong fix to a misdiagnosed problem.

`scripts/test-robots.mjs` asserts the live verdict through the same transport the importer
uses, and separately prints what undici sees, so a future change to either client is
noticed rather than silently re-introducing the confusion.

## Failure modes

Challenge HTML, a non-200 policy response, a policy that is not `text/plain`, a disallow
verdict, an oversized body, a redirect, repeated throttling, a pagination cycle beyond 500
pages, or an empty capture all stop the run. No partial corpus is published: the whole set
is staged and then moved into place behind a single pointer file, so a reader never sees a
half-written capture.

## Verification

`node scripts/test-robots.mjs` covers the parser without any network — longest-match
ordering, a named group beating the wildcard, an empty `Disallow` allowing everything, and
CRLF plus comments parsing identically to LF — then asserts the live verdict is an allow.

The CRLF case is not decoration. Guards that parse text on a Windows checkout routinely
match nothing when they assume `\n`, and a parser that silently returns a different verdict
depending on line endings is worse than one that fails outright.

## Suggested articles

- [Design language](../standards/design-language.md)
- [Delivery and hosting](../delivery/README.md)
