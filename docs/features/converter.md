# The file converter

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
