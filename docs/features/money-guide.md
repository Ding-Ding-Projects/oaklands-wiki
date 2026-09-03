# Money-making guide

At `/money/`. Every sell price the wiki records, ranked by what it earns and by
how much work it takes to get — worked out **separately**, which is the whole
point.

## Why the two rankings are computed independently

Scoring difficulty from value and then ranking by value is circular. Every
expensive thing comes out "hard" by construction, the guide confidently tells you
what it already assumed, and "high value, low effort" becomes impossible to
express because the model forbids it.

So **difficulty never reads price**. Its only inputs are:

| Input | Range | What it means |
|---|---|---|
| Region tier | 1–5 | how far into the world the thing is |
| Processing step | 0–2 | how much work stands between it and the money |
| Obtainability | forced to 5 | a limited or removed item cannot be farmed at all |

That independence is what makes the guide's most useful finding possible:
**Magnetite, $600 a stud, on the starting island, difficulty 1.5.**

## What counts as money

Only **sell-side** fields: `Ore`, `Refined`, `Forged`, `Log`, `Planked`,
`Sanded`, `Stone`, `$/burl`, `$/sanded`.

The generic `Price` field is excluded, and this was a real defect before it was.
`Price` is what an item **costs** — 398 of the articles carrying it also carry a
`Shop`, `Store` or `Cost` field naming where you buy the thing. Reading those as
income put a $10,000,000 shop-bought Nuclear Warhead — the largest money *sink*
in the game — at the top of a money-making guide, pointing every reader in
exactly the wrong direction.

### The unit comes from the value, never from the field name

`Log` usually holds `$1.6/stud`. A beehive's `Log` holds a flat `$1389` — you
chop one beehive, you do not measure it in studs. Trusting the label put that
$1389 into the per-stud table where it outranked every genuine per-stud price by
a factor of thirty and read as the best money in the game.

The string says which it is. The label only says which field someone typed it
into.

Per-stud and per-item prices are therefore ranked in **separate tables and never
compared**. Putting them in one list would report that burls beat ore by three
hundred times, when the two numbers do not measure the same quantity of anything.

### Event currencies are not money

`❅75,000` is snowflakes, `🥚25` is eggs, `🍬325` is candy, `3,199 Candy` is
candy again. 28 price fields are in one of these and are excluded.

Both snowflake characters are filtered: `❅` U+2745 and `❄️` U+2744 look alike and
are different codepoints, and the first version of the filter caught only one —
so a log priced `1❄️/stud³` was read as one dollar and entered the guide.

## Region tiers

The `Island` field is free text typed by contributors. It arrives with typos
(`Finaly`, `FInlay`, `Finley`, `Finland Island`), with biomes used in place of
islands, and with several places listed at once. Normalising it is unavoidable;
guessing at it is not, so every spelling in the table was read out of the corpus,
and anything unrecognised stays **unknown** rather than being forced into a tier.

Where an item lists several places the **easiest** counts — you only have to
reach one of them.

Tier 1 is the starting ground (Finlay, Flowering Meadows); tier 5 is the deepest
(Magma Caves, The Void, Mike's Mines, Azurite Fields).

## Why hardness is not used

The `Hardness` field exists and is deliberately ignored. Of the 34 articles that
carry it, **22 record `?`** and two more record `??`, so fewer than a third hold
a usable number. A signal missing for most of the data produces a ranking that
looks precise and is mostly guesswork.

## What this cannot tell you

Stated on the page itself, not only here:

- **61 of 144 items have no recorded region**, including every burl — the source
  records a burl's two prices and no location. Their difficulty uses the midpoint
  and is marked *estimated* in the table rather than presented as measured.
- **Nothing here measures time.** A price per stud says what a stud is worth, not
  how long it takes to harvest, walk back and sell. Two items at the same price
  can be very different amounts of work.
- **55 price fields could not be read** out of 446. `1M/stud` is not expanded:
  one article uses it, for a log whose real value is two orders of magnitude
  lower, so reading it as a million would put obvious vandalism at the top of the
  table.
- **These are a dated snapshot** of a community wiki, entered by hand. A wrong
  figure there is a wrong figure here.

## Surface

The page carries the contract like any other: its own search with an anchored
regex builder, sort by money, difficulty, money-per-effort or name, a difficulty
ceiling slider, an obtainable-only filter, and a per-tier starter section.
Difficulty is never colour alone — the pips are decoration and the number and its
label sit beside them as text.

## Verification

`npm run build:money` regenerates it and prints the counts. The generator refuses
to write an empty guide. Every figure on the page comes from
`data/generated/money.json`; nothing is typed by hand.
