#!/usr/bin/env node
/**
 * The simulator's engine is pure, so it is testable without a browser — and it
 * is the half worth testing. A gate that is subtly wrong produces a circuit that
 * looks like it runs and quietly computes the wrong answer.
 */
import assert from 'node:assert/strict';

// Node strips the type annotations itself; logic-sim.ts uses nothing beyond
// them, so no build step is needed to test the engine.
const { step, readOutput, SEGMENTS } = await import('../src/lib/logic-sim.ts');

const run = (circuit, ticks = 1, seed) => {
  let sim = seed ?? { signals: {}, memory: {}, tick: 0 };
  for (let i = 0; i < ticks; i += 1) sim = step(circuit, sim);
  return sim;
};

const gate = (kind, a, b) => ({
  nodes: [
    { id: 'a', kind: 'switch', x: 0, y: 0, value: a },
    { id: 'b', kind: 'switch', x: 0, y: 0, value: b },
    { id: 'g', kind, x: 0, y: 0 },
  ],
  wires: [
    { id: '1', from: { node: 'a', port: 'out' }, to: { node: 'g', port: 'a' } },
    { id: '2', from: { node: 'b', port: 'out' }, to: { node: 'g', port: 'b' } },
  ],
});

// Full truth tables. Every gate, every input combination.
const TABLES = {
  and:  [[0,0,0],[0,1,0],[1,0,0],[1,1,1]],
  or:   [[0,0,0],[0,1,1],[1,0,1],[1,1,1]],
  xor:  [[0,0,0],[0,1,1],[1,0,1],[1,1,0]],
  xand: [[0,0,1],[0,1,0],[1,0,0],[1,1,1]],
};
for (const [kind, rows] of Object.entries(TABLES)) {
  for (const [a, b, expected] of rows) {
    const sim = run(gate(kind, a, b), 2);
    assert.equal(sim.signals['g.out'], expected, `${kind}(${a},${b}) must be ${expected}`);
  }
}

// NOT, which takes one input.
for (const [input, expected] of [[0, 1], [1, 0]]) {
  const sim = run({
    nodes: [{ id: 'a', kind: 'switch', x: 0, y: 0, value: input }, { id: 'g', kind: 'not', x: 0, y: 0 }],
    wires: [{ id: '1', from: { node: 'a', port: 'out' }, to: { node: 'g', port: 'a' } }],
  }, 2);
  assert.equal(sim.signals['g.out'], expected, `not(${input}) must be ${expected}`);
}

// Greater Than compares values, not truthiness.
{
  const sim = run({
    nodes: [
      { id: 'a', kind: 'slider', x: 0, y: 0, value: 7 },
      { id: 'b', kind: 'slider', x: 0, y: 0, value: 3 },
      { id: 'g', kind: 'greater', x: 0, y: 0 },
    ],
    wires: [
      { id: '1', from: { node: 'a', port: 'out' }, to: { node: 'g', port: 'a' } },
      { id: '2', from: { node: 'b', port: 'out' }, to: { node: 'g', port: 'b' } },
    ],
  }, 2);
  assert.equal(sim.signals['g.out'], 1, '7 > 3');
}

// A half adder: the circuit the starter ships, checked against real arithmetic.
const halfAdder = (a, b) => ({
  nodes: [
    { id: 'a', kind: 'switch', x: 0, y: 0, value: a },
    { id: 'b', kind: 'switch', x: 0, y: 0, value: b },
    { id: 'sum', kind: 'xor', x: 0, y: 0 },
    { id: 'carry', kind: 'and', x: 0, y: 0 },
  ],
  wires: [
    { id: '1', from: { node: 'a', port: 'out' }, to: { node: 'sum', port: 'a' } },
    { id: '2', from: { node: 'b', port: 'out' }, to: { node: 'sum', port: 'b' } },
    { id: '3', from: { node: 'a', port: 'out' }, to: { node: 'carry', port: 'a' } },
    { id: '4', from: { node: 'b', port: 'out' }, to: { node: 'carry', port: 'b' } },
  ],
});
for (const [a, b] of [[0,0],[0,1],[1,0],[1,1]]) {
  const sim = run(halfAdder(a, b), 2);
  const total = sim.signals['sum.out'] + 2 * sim.signals['carry.out'];
  assert.equal(total, a + b, `half adder ${a}+${b} must total ${a + b}`);
}

// Memory cell: reset wins a tie, and the value survives with no input.
{
  const circuit = {
    nodes: [
      { id: 's', kind: 'switch', x: 0, y: 0, value: 1 },
      { id: 'r', kind: 'switch', x: 0, y: 0, value: 0 },
      { id: 'm', kind: 'memory', x: 0, y: 0 },
    ],
    wires: [
      { id: '1', from: { node: 's', port: 'out' }, to: { node: 'm', port: 'set' } },
      { id: '2', from: { node: 'r', port: 'out' }, to: { node: 'm', port: 'reset' } },
    ],
  };
  let sim = run(circuit, 2);
  assert.equal(sim.signals['m.out'], 1, 'set latches the cell');

  circuit.nodes[0].value = 0;
  sim = run(circuit, 2, sim);
  assert.equal(sim.signals['m.out'], 1, 'the cell holds after set is released');

  circuit.nodes[0].value = 1;
  circuit.nodes[1].value = 1;
  sim = run(circuit, 2, sim);
  assert.equal(sim.signals['m.out'], 0, 'reset wins when both arrive');
}

// Binary input to binary output: four bit lines round-trip a value.
{
  const circuit = {
    nodes: [
      { id: 'in', kind: 'binaryInput', x: 0, y: 0, value: 13 },
      { id: 'out', kind: 'binaryOutput', x: 0, y: 0 },
    ],
    wires: [0,1,2,3].map((i) => ({ id: `w${i}`, from: { node: 'in', port: `b${i}` }, to: { node: 'out', port: `b${i}` } })),
  };
  const sim = run(circuit, 2);
  assert.equal(readOutput(circuit, sim, circuit.nodes[1]), 13, '13 must survive the bit lines');
}

// Seven-segment patterns: every digit lights the right number of segments.
const EXPECTED_SEGMENTS = { 0: 6, 1: 2, 2: 5, 3: 5, 4: 4, 5: 5, 6: 6, 7: 3, 8: 7, 9: 6 };
for (const [digit, count] of Object.entries(EXPECTED_SEGMENTS)) {
  assert.equal(SEGMENTS[digit].filter(Boolean).length, count, `digit ${digit} lights ${count} segments`);
}

// An unconnected input reads 0 rather than producing NaN from one missing wire.
{
  const sim = run({ nodes: [{ id: 'g', kind: 'and', x: 0, y: 0 }], wires: [] }, 1);
  assert.equal(sim.signals['g.out'], 0, 'an unwired gate outputs 0, not NaN');
}

console.log('logic-sim: 4 truth tables, NOT, Greater Than, half adder, memory cell, bit lines, segments and unwired inputs all pass');
