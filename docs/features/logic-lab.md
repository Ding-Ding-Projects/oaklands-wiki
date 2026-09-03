# The logic lab

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
