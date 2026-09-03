#!/usr/bin/env python3
"""Write the per-feature documentation articles.

One article per capability, as the documentation contract requires: what it does,
how it is configured, how it fails, what it deliberately does not claim, and how
it was verified. Each ends with suggested reading so no article is a dead end.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FEATURES = ROOT / "docs" / "features"
FEATURES.mkdir(parents=True, exist_ok=True)

DOCS: dict[str, str] = {}

DOCS["README.md"] = """# Features

Each article covers one capability: what it does, how it is configured, how it
fails, what it deliberately does not claim, and how it was verified.

- [Language modes and funny levels](language-and-funny-levels.md)
- [Attention modes](attention-modes.md)
- [Toy locks and the unlock ladder](locks-and-ladder.md)
- [The logic lab](logic-lab.md)
- [Scheduled settings](scheduled-settings.md)
- [The file converter](converter.md)
- [Local history and exports](history-and-exports.md)
- [The authenticator](authenticator.md)
"""

DOCS["language-and-funny-levels.md"] = """# Language modes and funny levels

## Behaviour

Three language modes -- English, playful Hong Kong Cantonese, and bilingual --
and **two independent funny-level sliders**, one per language, both shipping at 5.

Bilingual mode renders both without crowding: the primary label stays prominent
and the second appears as a compact secondary label rather than doubling every
line at full weight.

## The funny level styles voice, never facts

This is the rule that matters. At every level, from 1 to 5, each message still
names what happened, what will be affected and what the options are. A playful
variant wraps the fact; it never replaces it. A warning nobody can act on is a
broken warning, not a funny one.

No category is exempt -- errors, destructive-action copy and accessibility text
are all styled -- which is why the setting discloses that plainly rather than
carving out exceptions nobody would find.

## School mode

School mode forces English presentation and makes the Cantonese, funny-level and
dim-sum capabilities behave as though they are **not installed**: their controls
and copy are omitted rather than disabled, because a disabled control still names
the thing it is hiding.

Prior choices are kept and return when it is switched off.

It is renameable, and after a rename every surface uses only the chosen name. It
is a user-experience lock, not a security boundary: clearing this site's storage
turns it off, and the surface says so rather than claiming protection it does not
provide.

## Failure modes

Storage may be unavailable. The setting still applies for the current visit and
the panel says it will not be remembered, rather than silently failing.

## Verification

Covered by the built-output guard for the settings surface and by the element
guard for its controls. Each string carries five variants per language, and the
resolver is a pure function that School mode short-circuits in one place.

## Suggested articles

- [Attention modes](attention-modes.md)
- [Scheduled settings](scheduled-settings.md)
"""

DOCS["logic-lab.md"] = """# The logic lab

## Behaviour

Place the logic parts the wiki documents, wire them, and run the circuit. Every
part in the palette corresponds to a real article -- AND, OR, NOT, XOR and XAND
gates, Greater Than, memory cells, delays, incrementors, clocks, binary inputs
and outputs, seven-segment displays and relays -- and each links back to it.

Three starter circuits ship, because a blank canvas is a hard place to begin: a
half adder, a clock driving a counter into a seven-segment display, and a
set/reset latch. They are real working circuits built only from the palette, so
opening one and taking it apart is the tutorial.

## How the engine works

Signals are numbers. A boolean part treats anything non-zero as true and emits 0
or 1, so a gate and a number interface share a wire without a second signal type
and the conversion rules that would come with it.

Evaluation is **bounded relaxation**, not a topological sort. A real circuit may
contain a feedback loop, and a topological sort simply refuses to order one.
Sequential parts -- memory, delay, incrementor -- read the previous tick and
write the next, which is what lets a loop settle at all.

## Decisions stated rather than left to chance

- An unconnected input reads **0**, so one missing wire cannot make `NaN`
  reachable from arithmetic downstream.
- An input takes **one** wire. A second connection replaces the first, so a value
  never depends on evaluation order.
- **Reset wins a tie** in the memory cell. An ambiguous latch is worse than a
  rule somebody can look up.
- A loop that never settles costs a fixed number of passes and reports itself,
  rather than spinning the tab.

## Failure modes

A circuit that oscillates is bounded rather than hung. A saved circuit that fails
to parse falls back to the starter already on screen rather than an empty canvas.

## Verification

`scripts/test-logic-sim.mjs` drives the engine with no browser: four complete
truth tables, NOT, Greater Than comparing values rather than truthiness, the half
adder checked against real arithmetic, the latch's tie-break, a value
round-tripping through four bit lines, every seven-segment digit lighting the
right number of segments, and an unwired gate outputting 0 rather than `NaN`.

Proved by breaking XOR into OR and by flipping the latch's tie-break: both go
red, both restore green.

## Suggested articles

- [Local history and exports](history-and-exports.md)
- [The file converter](converter.md)
"""

DOCS["locks-and-ladder.md"] = """# Toy locks and the unlock ladder

## It is just for fun

This is a self-imposed speed bump. It is **not encryption**, it secures nothing,
and it is no protection from anyone else using the same browser. Every surface
says so, and none of them describes it otherwise.

## Behaviour

Right-click any element to lock it. Six policies: PIN, password, PIN plus
password, password plus one-time code, PIN plus one-time code, and all three.

Each lock carries its **own** policy and its **own** credentials. There is no
master credential and no inheritance: unlocking one element never unlocks
another. Two elements sharing a PIN got there because somebody typed it twice.

A locked element is genuinely inert. Interception runs at the document level in
the capture phase, so a keyboard press or a programmatic click cannot walk around
a disabled attribute.

An unlock lasts as long as the visitor chose: this surface only, a number of
minutes, or until the browser closes.

## Credentials

Passwords and PINs are verified against a SHA-256 hash; nothing is stored in the
clear. One-time codes are RFC 6238 TOTP from a secret the visitor supplies from
their own authenticator -- nothing is generated, mailed or texted here.

A wrong attempt never characterises the stored value: not its length, not its
composition, not how close the attempt was.

## The unlock ladder

A lockout is the one moment a product has nothing to offer: a countdown, and a
person watching it. The ladder replaces the watching.

1. **Dim sum** -- one dish, four choices.
2. **Ten easy sums**, after five wrong dishes.
3. **Whack-a-mole**, after a lost round of sums.
4. **The clock**, after a lost round. The ladder is not offered again.

Falling to the bottom leaves the visitor exactly where they started, so the
ladder can only improve a locked-out afternoon.

### What it must never do

- It clears the **waiting**, never the **credential**. Winning returns you to the
  ordinary prompt and you still need your PIN.
- It never refunds the attempt budget.
- It is capped at **three skipped waits per rolling hour**. Four choices is
  one-in-four and a mole schedule is arithmetic; without the cap a script plays
  past every lockout and brute force gets cheaper, which is the single thing a
  lockout exists to prevent.
- It never slows the exponential escalation it skips.

A mole hit counts only against a mole genuinely visible in that cell, once, and
the round cannot be won faster than its own duration.

Under School mode the dim-sum rung is **absent** rather than skipped with a
message, because a message naming the hidden thing is what School mode forbids.
One function decides the first rung so no surface can get it wrong locally.

## Recovery

Forgetting a credential is a normal outcome for a toy. Clearing this site's
storage removes every lock. There is no reset ticket and no support channel,
because there is nothing to reset on any server -- and **Support Tickets** says
exactly that, in one plain line outside the comedy, before it opens the same
storage-clearing button.

## Verification

`scripts/test-locks.mjs` checks the base32 round trip, three published RFC 6238
SHA-1 vectors, and the ladder budget including its rolling-window expiry.

## Suggested articles

- [The authenticator](authenticator.md)
- [Language modes and funny levels](language-and-funny-levels.md)
"""

DOCS["attention-modes.md"] = """# Attention modes

## Behaviour

Five modes, **independently switchable and all off by default**: Focus, Low
stimulation, Time awareness, One thing at a time, and Momentum.

They are separate switches on purpose. Attention difficulties do not arrive as a
single setting: somebody may want the interface quieter without wanting time
nudges, or want time nudges precisely because they are hyperfocusing. Bundling
them means most people turn the whole thing off to escape the one part that does
not suit them.

## What each one does

- **Focus** brings the current item forward and pushes the rest back. Nothing is
  hidden that one action cannot bring back: an interface that disappears work is
  a worse problem than a busy one.
- **Low stimulation** removes the ambient wash and non-essential motion. It
  composes with the platform's own reduced-motion preference rather than
  overriding it -- somebody who has already asked the system for less motion has
  asked once.
- **Time awareness** shows how long the page has been open. Stating the number is
  the whole feature; nagging about it is not.
- **One thing at a time** keeps a single visible next action, chosen by the
  visitor, that survives a page change.
- **Momentum** offers a dismissible prompt after a long idle stretch, and "not
  now" is respected for a stated period rather than for thirty seconds.

## Tone

Copy is plain, factual and free of judgement. No streaks, no ranking, no
congratulation, no productivity score. "Nothing has changed here for 40 minutes"
is a fact; what to feel about it is not this software's business.

## Not medical

These are interface accommodations. No diagnosis, no assessment, no advice, and
no claim of clinical benefit. They are named for what they **do**, so somebody
can use one without disclosing anything about themselves to a colleague reading
over their shoulder.

## Suggested articles

- [Language modes and funny levels](language-and-funny-levels.md)
- [Scheduled settings](scheduled-settings.md)
"""

DOCS["scheduled-settings.md"] = """# Scheduled settings

## Behaviour

A rule selects a date range, a time window, and either every day or an explicit
set of weekdays. While it matches, it overlays settings -- theme, density,
language, accent, reduced motion.

Values come from the rule itself, from a validated HTTPS endpoint, or from a Home
Assistant boolean entity.

## Semantics, decided rather than guessed

- Times are interpreted in the **visitor's own timezone**, which is named on the
  surface so nobody has to infer it, and it follows that zone's daylight saving.
- A window that **crosses midnight** is two intervals, not an empty one.
- **Equal start and end means the whole day.** Nobody typing the same time twice
  meant a zero-length window.
- Start is inclusive, end is exclusive.
- An **empty weekday list means every day**, which is the common case and what a
  fresh rule starts with.
- When several rules match, the **last enabled one wins**, and the surface states
  that rather than leaving precedence to an array order nobody can see.

## A schedule is an overlay, never a write

The base settings are never overwritten. Turning every rule off returns exactly
what was there before, and what is saved is always the visitor's own choice.

## External sources

An endpoint must be HTTPS; anything else is refused. Responses are bounded,
redirects are rejected, and failure is non-blocking and fails safe: the last
local value stays in effect and the surface says the source could not be reached
rather than retrying silently or claiming a remote value was applied.

**No token is stored.** This browser has no credential vault, so an authenticated
Home Assistant endpoint will answer 401 and the rule falls back to local values
-- which is stated plainly rather than presented as a mysterious failure.

## Verification

`scripts/test-schedule.mjs` drives every boundary without a clock: the midnight
crossing, inclusive start and exclusive end, the whole-day case, weekdays, date
bounds, a disabled rule, malformed input refused rather than coerced into an
accidental match, and deterministic precedence in both orders.

## Suggested articles

- [Attention modes](attention-modes.md)
- [Language modes and funny levels](language-and-funny-levels.md)
"""

DOCS["converter.md"] = """# The file converter

## Behaviour

Converts a chosen file entirely in this browser. Nothing is uploaded, there is no
conversion service behind it, and the original file is never modified.

## The catalogue is honest about what it cannot do

Every format is listed, **including the unavailable ones**, each with its exact
reason. Hiding a gap makes the catalogue look complete and leaves somebody
hunting for a converter that was never there; a disabled row reading "needs a
bundled PDF library" answers the question in one glance.

**Working:** JSON, CSV, TSV and Markdown between each other; images re-encoded to
PNG, JPEG or WebP through a canvas; text normalised to UTF-8 with LF endings; any
file to base64.

**Listed and unavailable:** PDF split, merge and text extraction need a bundled
library this page does not ship. ZIP extraction needs central-directory parsing
the browser does not expose. DOCX is a ZIP of XML and needs the same. SVG
rasterisation needs sanitising that is not implemented, because an SVG can
reference remote content. HEIC cannot be decoded by this browser at all, so there
is nothing to re-encode from.

## Lossy conversions disclose their cost first

JPEG has no transparency, so transparent pixels become black. WebP here is lossy
at quality 0.92 and flattens the colour profile to sRGB. CSV carries no types, so
every value round-trips as a string. Only the first frame of an animation is
drawn.

## Failure modes

A conversion that fails names its reason and leaves the source file untouched.
Every category has its own search with an anchored regular-expression builder.

## Suggested articles

- [Local history and exports](history-and-exports.md)
- [The logic lab](logic-lab.md)
"""

DOCS["history-and-exports.md"] = """# Local history and exports

## Behaviour

Every creation, change and removal of visitor-owned state is recorded as a new
entry, in this browser only.

Entries record **what changed**, not that something did: "accent: #ffab5e to
#7fb2ff", never "Updated". An unchanged save records nothing, so the panel stays
a list of real events rather than a log of saves.

## Restoring is append-only

A restore adds a **new** entry rather than rewriting one. An undo can therefore
be undone, and that undo undone in turn. A restore that discards the branch it
replaces is the one failure that makes a history panel unsafe to open, because
you cannot experiment without risking the state you started from.

## Filtering

A date range, an action filter, and a text search with its own anchored
regular-expression builder. All three compose; none overrides another.

The action filter is **derived from the entries themselves** rather than
hard-coded, so a new kind of action appears automatically instead of being
missing from a list nobody remembered to update. Each action shows its count, so
an empty one is visibly empty rather than mysteriously absent.

## Bulk actions

Multi-select with an explicit scope. "Select all 12 matching" and "select all 340
entries" are **different buttons**, because leaving "all" to mean whichever the
reader assumed is how a bulk action surprises somebody. Inverse selection and
clear sit beside them.

## Exports

Eight formats that can carry a flat row set faithfully: JSON, JSON Lines, CSV,
TSV, Markdown, YAML, HTML and plain text. The export honours the active filter
and selection, so what downloads is what the panel shows.

Secrets are never included. Where an export omits something, it says so rather
than silently dropping a field.

## Failure modes

A history write never fails the operation it was recording. Storage that refuses
a write is reported rather than pretended.

## Suggested articles

- [The authenticator](authenticator.md)
- [The file converter](converter.md)
"""

DOCS["authenticator.md"] = """# The authenticator

## Behaviour

A local place to keep TOTP secrets and read live codes -- for this site's own
locks and for anything else. No account, no sync, no network, no telemetry.

Standards, not an approximation: RFC 6238 TOTP over RFC 4226 HOTP, SHA-1, 6
digits, 30-second period.

## QR pairing is drawn in this process

Never a QR web service and never a remote chart API. Rendering a pairing secret
through somebody else's server would hand them the secret on the way to drawing
it, so the encoder is bundled and no network call occurs anywhere in the flow.

The code is true black on white in both themes, with its quiet zone intact,
because tinting a QR into the palette is how a scannable code stops scanning. It
carries a real text alternative naming what it pairs, not a decorative `alt`.

The manual secret is shown beside it in grouped base32, behind an explicit
reveal, for pairing on the same device where a camera is no help.

## Pairing is confirmed before the factor arms

The visitor types one current code back, and only a match completes registration.
Without that step a mistyped or mis-scanned secret locks somebody out of a thing
they just set up, and the first they learn of it is when they need it.

## The clock is the failure nobody diagnoses

Codes come from the system clock. When it is skewed far enough that codes will be
refused, the surface says so plainly rather than emitting confidently wrong
digits with nothing to read.

## Secrets

Stored in this browser only. Ordinary exports omit them **and say so**. There is
no bulk secrets export; adding one would be a separate, explicitly named action
behind the destructive-action gate, warning that it writes usable secrets in the
clear.

Beyond the one-time registration reveal, nothing displays, hints at or
characterises a stored secret's value, length or composition.

## Verification

The three published RFC 6238 SHA-1 vectors, plus a base32 round trip, in
`scripts/test-locks.mjs`. An authenticator that is subtly wrong produces codes
rejected everywhere with no error to read, so matching the published vectors is
the only meaningful check.

## Suggested articles

- [Toy locks and the unlock ladder](locks-and-ladder.md)
- [Local history and exports](history-and-exports.md)
"""

written = 0
for name, body in DOCS.items():
    (FEATURES / name).write_text(body, encoding="utf-8")
    written += 1

print(f"wrote {written} feature article(s) into {FEATURES.relative_to(ROOT)}")
