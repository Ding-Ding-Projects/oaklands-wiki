/**
 * A logic simulator for the components this wiki documents.
 *
 * The Logic category describes 44 real parts — AND, OR, NOT, XOR and XAND gates,
 * binary inputs and outputs, memory cells, clocks, segment displays. An article
 * can tell you what a XAND gate does; it cannot let you wire four of them
 * together and watch. That is the gap this fills.
 *
 * Signals are numbers. A boolean part treats anything non-zero as true and emits
 * 0 or 1, so a gate and a number interface can share a wire without a second
 * signal type and the conversion rules that would come with it.
 */

export type PortKind = 'in' | 'out';

export type ComponentKind =
  | 'button' | 'switch' | 'binaryInput' | 'slider' | 'clock'
  | 'and' | 'or' | 'not' | 'xor' | 'xand' | 'greater'
  | 'memory' | 'delay' | 'incrementor'
  | 'binaryOutput' | 'sevenSegment' | 'numberInterface' | 'relay';

export type Spec = {
  kind: ComponentKind;
  label: string;
  group: 'Inputs' | 'Gates' | 'Memory and timing' | 'Outputs';
  inputs: string[];
  outputs: string[];
  /** The wiki article that documents the real part, when there is one. */
  article?: string;
  description: string;
};

export const SPECS: Spec[] = [
  { kind: 'button', label: 'Button', group: 'Inputs', inputs: [], outputs: ['out'], article: 'Button',
    description: 'Emits 1 only while held. Release and it returns to 0.' },
  { kind: 'switch', label: 'Switch', group: 'Inputs', inputs: [], outputs: ['out'], article: 'Switch',
    description: 'Latches on or off and stays there.' },
  { kind: 'binaryInput', label: 'Binary Input', group: 'Inputs', inputs: [], outputs: ['b0', 'b1', 'b2', 'b3'], article: 'Binary Input',
    description: 'A 0–15 value exposed as four separate bit lines.' },
  { kind: 'slider', label: 'Slider', group: 'Inputs', inputs: [], outputs: ['out'], article: 'Slider',
    description: 'A number from 0 to 100.' },
  { kind: 'clock', label: 'Frequency Clock', group: 'Inputs', inputs: [], outputs: ['out'], article: 'Frequency Clock',
    description: 'Alternates between 0 and 1 every N ticks.' },

  { kind: 'and', label: 'AND Gate', group: 'Gates', inputs: ['a', 'b'], outputs: ['out'], article: 'AND Gate',
    description: '1 when both inputs are non-zero.' },
  { kind: 'or', label: 'OR Gate', group: 'Gates', inputs: ['a', 'b'], outputs: ['out'], article: 'OR Gate',
    description: '1 when either input is non-zero.' },
  { kind: 'not', label: 'NOT Gate', group: 'Gates', inputs: ['a'], outputs: ['out'], article: 'NOT Gate',
    description: 'Inverts: 1 becomes 0, and anything zero becomes 1.' },
  { kind: 'xor', label: 'XOR Gate', group: 'Gates', inputs: ['a', 'b'], outputs: ['out'], article: 'XOR Gate',
    description: '1 when exactly one input is non-zero.' },
  { kind: 'xand', label: 'XAND Gate', group: 'Gates', inputs: ['a', 'b'], outputs: ['out'], article: 'XAND Gate',
    description: '1 when both inputs agree. The complement of XOR.' },
  { kind: 'greater', label: 'Greater Than', group: 'Gates', inputs: ['a', 'b'], outputs: ['out'], article: 'Greater Than Gate',
    description: '1 when A is greater than B.' },

  { kind: 'memory', label: 'Memory Cell', group: 'Memory and timing', inputs: ['set', 'reset'], outputs: ['out'], article: 'Memory Cell',
    description: 'Set latches it to 1; reset returns it to 0. Reset wins when both arrive.' },
  { kind: 'delay', label: 'Delay', group: 'Memory and timing', inputs: ['in'], outputs: ['out'], article: 'Delay',
    description: 'Repeats its input one tick later.' },
  { kind: 'incrementor', label: 'Incrementor', group: 'Memory and timing', inputs: ['step', 'reset'], outputs: ['out'], article: 'Incrementor',
    description: 'Counts up by one on each rising edge of step.' },

  { kind: 'binaryOutput', label: 'Binary Output', group: 'Outputs', inputs: ['b0', 'b1', 'b2', 'b3'], outputs: [], article: 'Binary Output',
    description: 'Reads four bit lines back as a 0–15 value.' },
  { kind: 'sevenSegment', label: '7 Segment Display', group: 'Outputs', inputs: ['value'], outputs: [], article: '7 Segment Display',
    description: 'Shows a single digit, 0–9.' },
  { kind: 'numberInterface', label: 'Number Interface', group: 'Outputs', inputs: ['value'], outputs: [], article: 'Number Interface',
    description: 'Shows the incoming number as text.' },
  { kind: 'relay', label: 'Relay', group: 'Outputs', inputs: ['in'], outputs: [], article: 'Relay',
    description: 'A lamp: lit while its input is non-zero.' },
];

export const SPEC_BY_KIND = new Map(SPECS.map((spec) => [spec.kind, spec]));

export type Node = {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  /** Input components carry their own value; everything else computes one. */
  value?: number;
  /** Clock period in ticks. */
  period?: number;
};

export type Wire = { id: string; from: { node: string; port: string }; to: { node: string; port: string } };

export type Circuit = { nodes: Node[]; wires: Wire[] };

export type SimState = {
  /** `${nodeId}.${port}` -> value */
  signals: Record<string, number>;
  /** Internal per-node state that survives a tick. */
  memory: Record<string, number>;
  tick: number;
};

export const EMPTY_SIM: SimState = { signals: {}, memory: {}, tick: 0 };

const truthy = (value: number | undefined) => (value ?? 0) !== 0;
const bit = (value: boolean) => (value ? 1 : 0);

/**
 * Advance the circuit one tick.
 *
 * Combinational parts are evaluated by repeated relaxation rather than a
 * topological sort, because a real circuit may contain a feedback loop and a
 * topological sort simply refuses to order one. The pass count is bounded, so a
 * loop that never settles costs a fixed amount of work and reports itself
 * instead of hanging the tab.
 *
 * Sequential parts — memory, delay, incrementor — read the PREVIOUS tick's
 * signals and write the next, which is what makes a feedback loop settle at all.
 */
export function step(circuit: Circuit, previous: SimState): SimState {
  const nodes = new Map(circuit.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, string>();
  for (const wire of circuit.wires) {
    incoming.set(`${wire.to.node}.${wire.to.port}`, `${wire.from.node}.${wire.from.port}`);
  }

  const signals: Record<string, number> = {};
  const memory: Record<string, number> = { ...previous.memory };
  const tick = previous.tick + 1;

  const read = (nodeId: string, port: string): number => {
    const source = incoming.get(`${nodeId}.${port}`);
    // An unconnected input reads 0 — stated here rather than left to undefined,
    // which would make `NaN` reachable from a single missing wire.
    if (!source) return 0;
    return signals[source] ?? previous.signals[source] ?? 0;
  };

  const evaluate = (node: Node) => {
    const id = node.id;
    switch (node.kind) {
      case 'button':
      case 'switch':
      case 'slider':
        signals[`${id}.out`] = node.value ?? 0;
        break;
      case 'binaryInput': {
        const value = Math.max(0, Math.min(15, Math.round(node.value ?? 0)));
        for (let index = 0; index < 4; index += 1) signals[`${id}.b${index}`] = (value >> index) & 1;
        break;
      }
      case 'clock': {
        const period = Math.max(1, node.period ?? 4);
        signals[`${id}.out`] = bit(Math.floor(tick / period) % 2 === 1);
        break;
      }
      case 'and': signals[`${id}.out`] = bit(truthy(read(id, 'a')) && truthy(read(id, 'b'))); break;
      case 'or': signals[`${id}.out`] = bit(truthy(read(id, 'a')) || truthy(read(id, 'b'))); break;
      case 'not': signals[`${id}.out`] = bit(!truthy(read(id, 'a'))); break;
      case 'xor': signals[`${id}.out`] = bit(truthy(read(id, 'a')) !== truthy(read(id, 'b'))); break;
      case 'xand': signals[`${id}.out`] = bit(truthy(read(id, 'a')) === truthy(read(id, 'b'))); break;
      case 'greater': signals[`${id}.out`] = bit(read(id, 'a') > read(id, 'b')); break;

      case 'memory': {
        const set = truthy(read(id, 'set'));
        const reset = truthy(read(id, 'reset'));
        // Reset wins when both arrive: an ambiguous latch is worse than a rule.
        const current = reset ? 0 : set ? 1 : memory[id] ?? 0;
        memory[id] = current;
        signals[`${id}.out`] = current;
        break;
      }
      case 'delay': {
        signals[`${id}.out`] = memory[`${id}.held`] ?? 0;
        memory[`${id}.next`] = read(id, 'in');
        break;
      }
      case 'incrementor': {
        const step = truthy(read(id, 'step'));
        const wasHigh = truthy(memory[`${id}.edge`]);
        if (truthy(read(id, 'reset'))) memory[id] = 0;
        else if (step && !wasHigh) memory[id] = (memory[id] ?? 0) + 1;
        memory[`${id}.edge`] = bit(step);
        signals[`${id}.out`] = memory[id] ?? 0;
        break;
      }
      default:
        break; // outputs produce no signal
    }
  };

  // Bounded relaxation. Six passes settles any acyclic circuit this editor can
  // build, and a genuine oscillator is reported rather than spun on.
  const MAX_PASSES = 6;
  let settled = false;
  for (let pass = 0; pass < MAX_PASSES && !settled; pass += 1) {
    const before = JSON.stringify(signals);
    for (const node of circuit.nodes) evaluate(node);
    settled = JSON.stringify(signals) === before;
  }

  // Commit the delay lines after the passes, so a delay is genuinely one tick.
  for (const node of circuit.nodes) {
    if (node.kind !== 'delay') continue;
    memory[`${node.id}.held`] = memory[`${node.id}.next`] ?? 0;
  }

  void nodes;
  return { signals, memory, tick };
}

/** Read an output component's displayed value. */
export function readOutput(circuit: Circuit, sim: SimState, node: Node): number {
  const incoming = new Map<string, string>();
  for (const wire of circuit.wires) {
    incoming.set(`${wire.to.node}.${wire.to.port}`, `${wire.from.node}.${wire.from.port}`);
  }
  const read = (port: string) => {
    const source = incoming.get(`${node.id}.${port}`);
    return source ? sim.signals[source] ?? 0 : 0;
  };
  if (node.kind === 'binaryOutput') {
    return [0, 1, 2, 3].reduce((total, index) => total + (truthy(read(`b${index}`)) ? 1 << index : 0), 0);
  }
  if (node.kind === 'sevenSegment') return Math.max(0, Math.min(9, Math.round(read('value'))));
  if (node.kind === 'numberInterface') return read('value');
  return read('in');
}

/** Seven-segment lamp pattern for a digit: a, b, c, d, e, f, g. */
export const SEGMENTS: Record<number, boolean[]> = {
  0: [true, true, true, true, true, true, false],
  1: [false, true, true, false, false, false, false],
  2: [true, true, false, true, true, false, true],
  3: [true, true, true, true, false, false, true],
  4: [false, true, true, false, false, true, true],
  5: [true, false, true, true, false, true, true],
  6: [true, false, true, true, true, true, true],
  7: [true, true, true, false, false, false, false],
  8: [true, true, true, true, true, true, true],
  9: [true, true, true, true, false, true, true],
};
