# The authenticator

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
