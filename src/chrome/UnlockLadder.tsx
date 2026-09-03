import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ladderRemaining, spendLadderWin, LADDER_BUDGET } from '../lib/locks';
import type { VisitorState } from '../lib/visitor-state';

/**
 * The unlock ladder — play your way out of a lockout.
 *
 * A lockout is the one moment a product has nothing to offer: a countdown, and a
 * person watching it. This replaces the watching with something to do.
 *
 *   1. Dim sum — one dish, four choices.
 *   2. Ten easy sums, after five wrong dishes.
 *   3. Whack-a-mole, after a lost round of sums.
 *   4. The clock, after a lost round. The ladder is not offered again.
 *
 * Falling to the bottom leaves you exactly where you started, so the ladder can
 * only ever improve a locked-out afternoon.
 *
 * WHAT IT MUST NEVER DO, and the whole safety of the feature:
 *
 * - It clears the WAITING, never the CREDENTIAL. Winning returns you to the
 *   ordinary prompt and you still have to know your PIN. "Guess a dumpling" is
 *   not an authentication factor.
 * - It never refunds the attempt budget.
 * - It is budgeted at three skipped waits per rolling hour. Four choices is
 *   one-in-four and a mole schedule is arithmetic; without the cap a script
 *   plays past every lockout and brute force gets cheaper.
 * - It never slows the exponential escalation it skips.
 *
 * Under School mode the dim-sum rung is ABSENT rather than skipped with a
 * message, because a message naming the hidden thing is what School mode forbids.
 */

type Rung = 'dimsum' | 'sums' | 'moles' | 'clock';

const DISHES = [
  'Har gow', 'Siu mai', 'Char siu bao', 'Cheung fun', 'Lo mai gai',
  'Egg tart', 'Turnip cake', 'Phoenix claws', 'Sesame ball', 'Congee',
];

/** One function decides the first rung, so no surface can get School mode wrong. */
export function firstRung(schoolMode: boolean): Rung {
  return schoolMode ? 'sums' : 'dimsum';
}

function makeSums(seed: number) {
  const rand = (n: number) => Math.floor(((seed * 9301 + n * 49297) % 233280) / 233280 * n);
  return Array.from({ length: 10 }, (_, index) => {
    const a = 2 + rand(index + 7) % 18;
    const b = 2 + rand(index + 13) % 18;
    return { a, b, answer: a + b };
  });
}

export function UnlockLadder({
  target, state, onCleared, onClose,
}: {
  target: string;
  state: VisitorState;
  onCleared: () => void;
  onClose: () => void;
}) {
  const [rung, setRung] = useState<Rung>(() => firstRung(state.schoolMode));
  const [wrongDishes, setWrongDishes] = useState(0);
  const [dish, setDish] = useState(() => Math.floor(Math.random() * DISHES.length));
  const [sumIndex, setSumIndex] = useState(0);
  const [sumAnswer, setSumAnswer] = useState('');
  const [seed] = useState(() => Date.now() % 1000);
  const [moles, setMoles] = useState<number[]>([]);
  const [hits, setHits] = useState(0);
  const [roundEnds, setRoundEnds] = useState(0);
  const hitCells = useRef<Set<number>>(new Set());
  const remaining = ladderRemaining(target);

  const sums = useMemo(() => makeSums(seed), [seed]);

  const win = useCallback(() => {
    // Spend the budget. If it is exhausted the clock is the only way through,
    // and that is stated rather than silently ignoring the win.
    if (spendLadderWin(target)) onCleared();
    else setRung('clock');
  }, [target, onCleared]);

  // Mole round: a fixed duration, so a submission cannot arrive before it ends.
  useEffect(() => {
    if (rung !== 'moles') return;
    hitCells.current = new Set();
    setHits(0);
    setRoundEnds(Date.now() + 12000);
    const timer = window.setInterval(() => {
      setMoles([Math.floor(Math.random() * 9), Math.floor(Math.random() * 9)]);
    }, 900);
    const finish = window.setTimeout(() => {
      window.clearInterval(timer);
      setMoles([]);
      // Graded here, after the round's own duration has genuinely elapsed.
      setHits((current) => { if (current >= 6) win(); else setRung('clock'); return current; });
    }, 12000);
    return () => { window.clearInterval(timer); window.clearTimeout(finish); };
  }, [rung, win]);

  const dishOptions = useMemo(() => {
    const wrong = DISHES.filter((_, index) => index !== dish).sort(() => Math.random() - 0.5).slice(0, 3);
    return [...wrong, DISHES[dish]].sort();
  }, [dish]);

  const choose = (name: string) => {
    if (name === DISHES[dish]) { win(); return; }
    const next = wrongDishes + 1;
    setWrongDishes(next);
    setDish(Math.floor(Math.random() * DISHES.length));
    if (next >= 5) setRung('sums');
  };

  const submitSum = (event: React.FormEvent) => {
    event.preventDefault();
    if (Number(sumAnswer) !== sums[sumIndex].answer) { setRung('moles'); return; }
    if (sumIndex + 1 >= sums.length) { win(); return; }
    setSumIndex(sumIndex + 1);
    setSumAnswer('');
  };

  const whack = (cell: number) => {
    // A hit counts only against a mole genuinely visible in that cell, and each
    // mole counts once — otherwise "hit the moles" degrades into "send taps".
    if (Date.now() > roundEnds) return;
    if (!moles.includes(cell) || hitCells.current.has(cell)) return;
    hitCells.current.add(cell);
    setHits((h) => h + 1);
  };

  return (
    <div className="ok-sheet" role="dialog" aria-label="Unlock ladder">
      <div className="ok-sheet__head">
        <h2>Rather than watch a countdown</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Just wait instead</button>
      </div>

      <p className="ok-muted">
        Winning ends <strong>the wait</strong> and nothing else — you still need your
        {' '}credential afterwards. {remaining} of {LADDER_BUDGET} skips left this hour.
      </p>

      {rung === 'dimsum' ? (
        <div className="ok-ladder" data-capability="dim-sum">
          <p className="ok-eyebrow">Which dish is this?</p>
          <p className="ok-ladder__prompt">🥟 A steamer of <strong>{DISHES[dish]}</strong>… or is it?</p>
          <div className="ok-ladder__options">
            {dishOptions.map((name) => (
              <button key={name} type="button" onClick={() => choose(name)}>{name}</button>
            ))}
          </div>
          <p className="ok-muted">{wrongDishes} wrong so far. Five wrong moves on to sums.</p>
        </div>
      ) : null}

      {rung === 'sums' ? (
        <form className="ok-ladder" onSubmit={submitSum}>
          <p className="ok-eyebrow">Sum {sumIndex + 1} of {sums.length}</p>
          <p className="ok-ladder__prompt">{sums[sumIndex].a} + {sums[sumIndex].b} = ?</p>
          <input
            type="number" inputMode="numeric" autoFocus value={sumAnswer}
            aria-label="Answer"
            onChange={(event) => setSumAnswer(event.target.value)}
          />
          <button type="submit">Check</button>
          <p className="ok-muted">Every one must be right. One wrong moves on to the moles.</p>
        </form>
      ) : null}

      {rung === 'moles' ? (
        <div className="ok-ladder">
          <p className="ok-eyebrow">Hit {6} moles before the round ends</p>
          <p className="ok-ladder__prompt">
            Hits: <strong>{hits}</strong> · {Math.max(0, Math.ceil((roundEnds - Date.now()) / 1000))}s left
          </p>
          <div className="ok-moles">
            {Array.from({ length: 9 }, (_, cell) => (
              <button
                key={cell}
                type="button"
                aria-label={moles.includes(cell) ? 'Mole' : 'Empty hole'}
                data-mole={moles.includes(cell) || undefined}
                onClick={() => whack(cell)}
              >
                {moles.includes(cell) ? '🐹' : ''}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {rung === 'clock' ? (
        <div className="ok-ladder">
          <p className="ok-ladder__prompt">That is the ladder for this lockout.</p>
          <p className="ok-muted">
            Serve the wait you were already serving — you are exactly where you started, and
            nothing has been taken away.
          </p>
          <button type="button" onClick={onClose}>Back to the wait</button>
        </div>
      ) : null}
    </div>
  );
}
