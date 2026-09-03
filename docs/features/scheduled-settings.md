# Scheduled settings

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
