#!/usr/bin/env python3
"""Generate the Open Graph embed graphic from the site's own design tokens.

Deterministic: same tokens in, same bytes out. Writes the repository-root master
only; `scripts/copy-social-preview.mjs` publishes the byte-identical served copy.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parent.parent
TOKENS = (ROOT / "src" / "styles" / "tokens.css").read_text(encoding="utf-8")

def token(name: str, default: str) -> str:
    m = re.search(rf"^\s*--{re.escape(name)}:\s*(#[0-9a-fA-F]{{3,8}})\s*;", TOKENS, re.M)
    return m.group(1) if m else default

PAPER  = token("ok-paper", "#fbf9f5")
INK    = token("ok-ink", "#1f1b16")
MUTED  = token("ok-ink-muted", "#5c5348")
RULE   = token("ok-rule", "#ddd5c8")
ACCENT = token("ok-accent", "#8a5a2b")
CATS = [token(f"ok-cat-{n}", "#888888") for n in
        ("ores","trees","tools","items","locations","structures","logic","vinyls","vehicles","events","npcs")]

W, H = 1200, 630
img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)

def font(size, bold=False):
    for name in (("georgiab.ttf","georgia.ttf") if bold else ("georgia.ttf",)):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    for name in (("segoeuib.ttf",) if bold else ("segoeui.ttf",)):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return ImageFont.load_default(size)

M = 84
# Category identity bar — the real material tones, in order.
swatch_w = (W - 2 * M) // len(CATS)
for i, colour in enumerate(CATS):
    d.rectangle([M + i * swatch_w, M, M + (i + 1) * swatch_w - 6, M + 10], fill=colour)

d.text((M, M + 52), "UNOFFICIAL ENCYCLOPEDIA", font=font(22, True), fill=MUTED)
d.text((M, M + 96), "Oaklands Wiki", font=font(96, True), fill=INK)
d.text((M, M + 216), "A reading-first archive of the community wiki,", font=font(38), fill=MUTED)
d.text((M, M + 268), "rebuilt to be readable on a phone.", font=font(38), fill=MUTED)

d.line([M, H - M - 92, W - M, H - M - 92], fill=RULE, width=2)
d.text((M, H - M - 62), "1,066 articles  ·  CC BY-SA  ·  Ding Ding Projects", font=font(28), fill=MUTED)
d.rectangle([W - M - 8, M + 96, W - M, M + 200], fill=ACCENT)

# Both copies come from this one run. The Pages pipeline can only serve files
# under the built output, so the served copy is a second file -- and two copies
# of a picture are two pictures that will disagree eventually. The bundle guard
# asserts they are byte-identical.
import hashlib
targets = [ROOT / "social-preview.png", ROOT / "public" / "social-preview.png"]
for out in targets:
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
digests = {hashlib.sha256(t.read_bytes()).hexdigest() for t in targets}
if len(digests) != 1:
    sys.exit("social preview copies differ; refusing to ship drift")
print(f"wrote {len(targets)} copies {img.size[0]}x{img.size[1]} "
      f"{targets[0].stat().st_size} bytes sha256={digests.pop()[:16]}")
