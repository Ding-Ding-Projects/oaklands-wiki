import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shell } from '../components/Shell';
import { href } from '../lib/routes';
import {
  SPECS, SPEC_BY_KIND, EMPTY_SIM, SEGMENTS, step, readOutput,
  type Circuit, type ComponentKind, type Node, type SimState,
} from '../lib/logic-sim';
import { serialise, download, EXPORT_FORMATS, type ExportFormat } from '../lib/history';

/**
 * The logic lab: place the wiki's own logic parts, wire them, and watch.
 *
 * An article can tell you what a XAND gate does. It cannot let you build a
 * two-bit adder out of four of them and see the carry appear. Every part here is
 * one the Logic category documents, and each links back to its article.
 */

const GRID = 20;
const KEY = 'oaklands.circuit.v1';

const STARTERS: { name: string; description: string; build: () => Circuit }[] = [
  {
    name: 'Half adder',
    description: 'Two switches in, a sum and a carry out. XOR gives the sum, AND gives the carry.',
    build: () => ({
      nodes: [
        { id: 'a', kind: 'switch', x: 40, y: 60, value: 0 },
        { id: 'b', kind: 'switch', x: 40, y: 160, value: 0 },
        { id: 'sum', kind: 'xor', x: 240, y: 70 },
        { id: 'carry', kind: 'and', x: 240, y: 180 },
        { id: 'lampSum', kind: 'relay', x: 440, y: 70 },
        { id: 'lampCarry', kind: 'relay', x: 440, y: 180 },
      ],
      wires: [
        { id: 'w1', from: { node: 'a', port: 'out' }, to: { node: 'sum', port: 'a' } },
        { id: 'w2', from: { node: 'b', port: 'out' }, to: { node: 'sum', port: 'b' } },
        { id: 'w3', from: { node: 'a', port: 'out' }, to: { node: 'carry', port: 'a' } },
        { id: 'w4', from: { node: 'b', port: 'out' }, to: { node: 'carry', port: 'b' } },
        { id: 'w5', from: { node: 'sum', port: 'out' }, to: { node: 'lampSum', port: 'in' } },
        { id: 'w6', from: { node: 'carry', port: 'out' }, to: { node: 'lampCarry', port: 'in' } },
      ],
    }),
  },
  {
    name: 'Counting display',
    description: 'A clock drives an incrementor into a seven-segment display.',
    build: () => ({
      nodes: [
        { id: 'clk', kind: 'clock', x: 40, y: 100, period: 4 },
        { id: 'count', kind: 'incrementor', x: 240, y: 100 },
        { id: 'seg', kind: 'sevenSegment', x: 440, y: 90 },
      ],
      wires: [
        { id: 'w1', from: { node: 'clk', port: 'out' }, to: { node: 'count', port: 'step' } },
        { id: 'w2', from: { node: 'count', port: 'out' }, to: { node: 'seg', port: 'value' } },
      ],
    }),
  },
  {
    name: 'Latch',
    description: 'Two buttons: one sets the memory cell, the other resets it. Reset wins a tie.',
    build: () => ({
      nodes: [
        { id: 'set', kind: 'button', x: 40, y: 60, value: 0 },
        { id: 'reset', kind: 'button', x: 40, y: 160, value: 0 },
        { id: 'cell', kind: 'memory', x: 240, y: 100 },
        { id: 'lamp', kind: 'relay', x: 440, y: 100 },
      ],
      wires: [
        { id: 'w1', from: { node: 'set', port: 'out' }, to: { node: 'cell', port: 'set' } },
        { id: 'w2', from: { node: 'reset', port: 'out' }, to: { node: 'cell', port: 'reset' } },
        { id: 'w3', from: { node: 'cell', port: 'out' }, to: { node: 'lamp', port: 'in' } },
      ],
    }),
  },
];

export function LogicLab() {
  // The starter is the INITIAL state, not something an effect fills in later:
  // the server renders this same circuit, so the page is meaningful before any
  // JavaScript runs and hydration has identical markup to match against.
  const [circuit, setCircuit] = useState<Circuit>(() => STARTERS[0].build());
  const [sim, setSim] = useState<SimState>(EMPTY_SIM);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ node: string; port: string } | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [format, setFormat] = useState<ExportFormat>('json');
  const [message, setMessage] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setCircuit(JSON.parse(raw));
    } catch { /* a corrupt saved circuit falls back to the starter already rendered */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify(circuit)); } catch { /* not remembered */ }
  }, [circuit]);

  // The clock only advances while running, so a static circuit is stable and a
  // person can reason about it without a moving target.
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSim((current) => step(circuit, current)), 200);
    return () => window.clearInterval(timer);
  }, [running, circuit]);

  // A single tick after any edit, so wiring something shows its effect at once.
  useEffect(() => { setSim((current) => step(circuit, current)); }, [circuit]);

  const nodeById = useMemo(() => new Map(circuit.nodes.map((n) => [n.id, n])), [circuit.nodes]);

  const add = (kind: ComponentKind) => {
    const spec = SPEC_BY_KIND.get(kind)!;
    const id = `${kind}${Date.now().toString(36)}`;
    const node: Node = { id, kind, x: 60 + (circuit.nodes.length % 5) * 40, y: 60 + (circuit.nodes.length % 7) * 30 };
    if (kind === 'clock') node.period = 4;
    if (spec.inputs.length === 0) node.value = 0;
    setCircuit((c) => ({ ...c, nodes: [...c.nodes, node] }));
    setMessage(`Added ${spec.label}.`);
  };

  const removeNode = (id: string) =>
    setCircuit((c) => ({
      nodes: c.nodes.filter((n) => n.id !== id),
      // A wire to a part that no longer exists is not a wire.
      wires: c.wires.filter((w) => w.from.node !== id && w.to.node !== id),
    }));

  const connect = (to: { node: string; port: string }) => {
    if (!pending) return;
    if (pending.node === to.node) { setPending(null); setMessage('A part cannot wire to itself.'); return; }
    setCircuit((c) => ({
      ...c,
      // One wire per input: a second connection replaces the first rather than
      // silently making the value depend on iteration order.
      wires: [
        ...c.wires.filter((w) => !(w.to.node === to.node && w.to.port === to.port)),
        { id: `w${Date.now().toString(36)}`, from: pending, to },
      ],
    }));
    setPending(null);
    setMessage('Wired.');
  };

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!drag || !surfaceRef.current) return;
    const box = surfaceRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.round((event.clientX - box.left - drag.dx) / GRID) * GRID);
    const y = Math.max(0, Math.round((event.clientY - box.top - drag.dy) / GRID) * GRID);
    setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => (n.id === drag.id ? { ...n, x, y } : n)) }));
  }, [drag]);

  const exportCircuit = () => {
    const spec = EXPORT_FORMATS.find((f) => f.id === format)!;
    const rows = circuit.nodes.map((node) => ({
      id: node.id,
      part: SPEC_BY_KIND.get(node.kind)?.label ?? node.kind,
      x: node.x, y: node.y,
      value: node.value ?? '',
      wiredFrom: circuit.wires.filter((w) => w.to.node === node.id).map((w) => `${w.from.node}.${w.from.port}→${w.to.port}`).join('; '),
    }));
    download(serialise(rows, format, 'Oaklands logic circuit'), `oaklands-circuit.${spec.extension}`, spec.mime);
  };

  const portPosition = (node: Node, port: string, kind: 'in' | 'out') => {
    const spec = SPEC_BY_KIND.get(node.kind)!;
    const ports = kind === 'in' ? spec.inputs : spec.outputs;
    const index = ports.indexOf(port);
    return {
      x: node.x + (kind === 'in' ? 0 : 140),
      y: node.y + 34 + index * 20,
    };
  };

  return (
    <Shell current="logic">
      <section className="ok-hero" style={{ paddingBlockEnd: 'var(--ok-space-4)' }}>
        <p className="ok-eyebrow">Logic lab</p>
        <h1>Build it, then watch it run</h1>
        <p className="ok-hero__lede">
          Every part here is one the wiki&rsquo;s Logic category documents. An article can tell
          you what a XAND gate does; this lets you wire four of them together and see.
        </p>
      </section>

      <div className="ok-lab">
        <aside className="ok-lab__palette" aria-label="Parts">
          {(['Inputs', 'Gates', 'Memory and timing', 'Outputs'] as const).map((group) => (
            <section key={group}>
              <p className="ok-eyebrow">{group}</p>
              <div className="ok-lab__parts">
                {SPECS.filter((spec) => spec.group === group).map((spec) => (
                  <button key={spec.kind} type="button" className="ok-chip" title={spec.description} onClick={() => add(spec.kind)}>
                    {spec.label}
                  </button>
                ))}
              </div>
            </section>
          ))}

          <section>
            <p className="ok-eyebrow">Start from</p>
            <div className="ok-lab__parts">
              {STARTERS.map((starter) => (
                <button key={starter.name} type="button" className="ok-chip" title={starter.description}
                  onClick={() => { setCircuit(starter.build()); setSim(EMPTY_SIM); setMessage(`Loaded: ${starter.name}.`); }}>
                  {starter.name}
                </button>
              ))}
            </div>
            <p className="ok-field__hint">
              A blank canvas is a hard place to begin, so these are real working circuits built
              only from the parts above — open one and take it apart.
            </p>
          </section>
        </aside>

        <div className="ok-lab__main">
          <div className="ok-lab__toolbar">
            <button type="button" onClick={() => setRunning((r) => !r)}>{running ? '⏸ Pause' : '▶ Run'}</button>
            <button type="button" onClick={() => setSim((current) => step(circuit, current))} disabled={running}>Step</button>
            <button type="button" onClick={() => setSim(EMPTY_SIM)}>Reset state</button>
            <span className="ok-muted">tick {sim.tick}</span>
            <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 'var(--ok-space-2)' }}>
              <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} aria-label="Export format">
                {EXPORT_FORMATS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </select>
              <button type="button" onClick={exportCircuit}>Export</button>
              <button type="button" onClick={() => { setCircuit({ nodes: [], wires: [] }); setSim(EMPTY_SIM); }}>Clear</button>
            </span>
          </div>

          {message ? <p className="ok-muted" role="status">{message}</p> : null}

          <div
            className="ok-lab__surface"
            ref={surfaceRef}
            onPointerMove={onPointerMove}
            onPointerUp={() => setDrag(null)}
            onPointerLeave={() => setDrag(null)}
          >
            <svg className="ok-lab__wires" aria-hidden="true">
              {circuit.wires.map((wire) => {
                const from = nodeById.get(wire.from.node);
                const to = nodeById.get(wire.to.node);
                if (!from || !to) return null;
                const a = portPosition(from, wire.from.port, 'out');
                const b = portPosition(to, wire.to.port, 'in');
                const live = (sim.signals[`${wire.from.node}.${wire.from.port}`] ?? 0) !== 0;
                return (
                  <path
                    key={wire.id}
                    d={`M ${a.x} ${a.y} C ${a.x + 50} ${a.y}, ${b.x - 50} ${b.y}, ${b.x} ${b.y}`}
                    className={live ? 'is-live' : undefined}
                  />
                );
              })}
            </svg>

            {circuit.nodes.map((node) => {
              const spec = SPEC_BY_KIND.get(node.kind)!;
              const output = spec.outputs.length === 0 ? readOutput(circuit, sim, node) : null;
              return (
                <div
                  key={node.id}
                  className="ok-part"
                  data-selected={selected === node.id || undefined}
                  style={{ insetInlineStart: node.x, insetBlockStart: node.y }}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).closest('button, input')) return;
                    const box = surfaceRef.current!.getBoundingClientRect();
                    setDrag({ id: node.id, dx: event.clientX - box.left - node.x, dy: event.clientY - box.top - node.y });
                    setSelected(node.id);
                  }}
                >
                  <div className="ok-part__head">
                    <span>{spec.label}</span>
                    <button type="button" aria-label={`Remove ${spec.label}`} onClick={() => removeNode(node.id)}>✕</button>
                  </div>

                  <div className="ok-part__ports">
                    <div>
                      {spec.inputs.map((port) => (
                        <button
                          key={port}
                          type="button"
                          className="ok-port"
                          data-kind="in"
                          aria-label={`Input ${port} of ${spec.label}`}
                          onClick={() => connect({ node: node.id, port })}
                        >
                          {port}
                        </button>
                      ))}
                    </div>
                    <div>
                      {spec.outputs.map((port) => (
                        <button
                          key={port}
                          type="button"
                          className="ok-port"
                          data-kind="out"
                          data-live={(sim.signals[`${node.id}.${port}`] ?? 0) !== 0 || undefined}
                          data-pending={pending?.node === node.id && pending.port === port ? true : undefined}
                          aria-label={`Output ${port} of ${spec.label}`}
                          onClick={() => setPending({ node: node.id, port })}
                        >
                          {port}
                        </button>
                      ))}
                    </div>
                  </div>

                  {node.kind === 'button' ? (
                    <button
                      type="button" className="ok-part__control"
                      onPointerDown={() => setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => n.id === node.id ? { ...n, value: 1 } : n) }))}
                      onPointerUp={() => setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => n.id === node.id ? { ...n, value: 0 } : n) }))}
                    >
                      Hold
                    </button>
                  ) : null}

                  {node.kind === 'switch' ? (
                    <button
                      type="button" className="ok-part__control" aria-pressed={(node.value ?? 0) !== 0}
                      onClick={() => setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => n.id === node.id ? { ...n, value: (n.value ?? 0) ? 0 : 1 } : n) }))}
                    >
                      {(node.value ?? 0) ? 'On' : 'Off'}
                    </button>
                  ) : null}

                  {node.kind === 'slider' || node.kind === 'binaryInput' ? (
                    <input
                      type="range" min={0} max={node.kind === 'binaryInput' ? 15 : 100}
                      value={node.value ?? 0}
                      aria-label={`${spec.label} value`}
                      onChange={(event) => setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => n.id === node.id ? { ...n, value: Number(event.target.value) } : n) }))}
                    />
                  ) : null}

                  {node.kind === 'clock' ? (
                    <label className="ok-part__control">
                      every
                      <input
                        type="number" min={1} max={40} value={node.period ?? 4}
                        aria-label="Clock period in ticks"
                        onChange={(event) => setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => n.id === node.id ? { ...n, period: Number(event.target.value) } : n) }))}
                      />
                      ticks
                    </label>
                  ) : null}

                  {node.kind === 'relay' ? <span className="ok-lamp" data-lit={output !== 0 || undefined} /> : null}
                  {node.kind === 'numberInterface' || node.kind === 'binaryOutput' ? (
                    <output className="ok-part__value">{output}</output>
                  ) : null}
                  {node.kind === 'sevenSegment' ? <SevenSegment value={output ?? 0} /> : null}

                  {spec.article ? (
                    <a className="ok-part__link" href={href(`/wiki/${spec.article.replace(/ /g, '_')}/`)}>
                      Read the article
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="ok-field__hint">
            Click an output port, then an input port, to wire them. An input takes one wire; a
            second replaces the first rather than leaving the value to depend on evaluation
            order. Feedback loops are allowed and settle through the memory and delay parts —
            a loop that never settles is bounded and reported, not spun on.
          </p>
        </div>
      </div>
    </Shell>
  );
}

function SevenSegment({ value }: { value: number }) {
  const lit = SEGMENTS[Math.max(0, Math.min(9, Math.round(value)))] ?? SEGMENTS[0];
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  return (
    <span className="ok-seg" role="img" aria-label={`Seven segment display showing ${value}`}>
      {names.map((name, index) => <i key={name} data-seg={name} data-on={lit[index] || undefined} />)}
    </span>
  );
}
