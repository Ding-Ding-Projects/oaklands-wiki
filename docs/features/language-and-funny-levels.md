# Language modes and funny levels

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
