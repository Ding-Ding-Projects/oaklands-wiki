import { useEffect, useRef, useState } from 'react';
import type { VisitorState } from '../lib/visitor-state';

/**
 * The attention modes that need a surface rather than a stylesheet rule.
 *
 * Tone matters more here than almost anywhere else. Every line states a fact and
 * nothing about how anybody should feel about it: no streak, no score, no
 * congratulation, no scolding. "Nothing has changed here for 40 minutes" is the
 * whole feature; nagging about it is not.
 *
 * These are interface accommodations, not medical anything. They are named for
 * what they do, so somebody can use them without disclosing anything about
 * themselves to a colleague reading over their shoulder.
 */

const IDLE_PROMPT_MS = 15 * 60 * 1000;
const SNOOZE_MS = 30 * 60 * 1000;
const ONE_THING_KEY = 'oaklands.oneThing';

function formatElapsed(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hour${hours === 1 ? '' : 's'}` : `${hours}h ${rest}m`;
}

export function AttentionBar({ state }: { state: VisitorState }) {
  const [elapsed, setElapsed] = useState(0);
  const [oneThing, setOneThing] = useState('');
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const snoozedUntil = useRef(0);
  const opened = useRef(Date.now());
  const lastActivity = useRef(Date.now());

  const { timeAwareness, oneThing: oneThingOn, momentum } = state.attention;
  const any = timeAwareness || oneThingOn || momentum;

  useEffect(() => {
    if (!oneThingOn) return;
    try { setOneThing(window.localStorage.getItem(ONE_THING_KEY) ?? ''); } catch { /* storage may be off */ }
  }, [oneThingOn]);

  useEffect(() => {
    if (!any) return;
    const mark = () => { lastActivity.current = Date.now(); };
    for (const event of ['pointerdown', 'keydown', 'scroll'] as const) {
      window.addEventListener(event, mark, { passive: true });
    }
    const timer = window.setInterval(() => {
      setElapsed(Date.now() - opened.current);
      if (!momentum) return;
      const idle = Date.now() - lastActivity.current;
      if (idle > IDLE_PROMPT_MS && Date.now() > snoozedUntil.current) setPrompt(true);
    }, 15000);
    return () => {
      window.clearInterval(timer);
      for (const event of ['pointerdown', 'keydown', 'scroll'] as const) {
        window.removeEventListener(event, mark);
      }
    };
  }, [any, momentum]);

  if (!any) return null;

  const saveOneThing = (value: string) => {
    setOneThing(value);
    try { window.localStorage.setItem(ONE_THING_KEY, value); } catch { /* not remembered, still applied */ }
  };

  return (
    <div className="ok-attention-bar" role="status">
      {timeAwareness ? (
        <span>
          Open for <b>{formatElapsed(elapsed)}</b>
        </span>
      ) : null}

      {oneThingOn ? (
        editing ? (
          <form
            onSubmit={(event) => { event.preventDefault(); setEditing(false); }}
            style={{ display: 'flex', gap: 'var(--ok-space-2)' }}
          >
            <input
              type="text"
              aria-label="What you are here to do"
              value={oneThing}
              autoFocus
              maxLength={120}
              onChange={(event) => saveOneThing(event.target.value)}
            />
            <button type="submit" className="ok-chip">Save</button>
          </form>
        ) : (
          <button type="button" className="ok-chip" onClick={() => setEditing(true)}>
            {oneThing ? `▸ ${oneThing}` : 'Set what you are here to do'}
          </button>
        )
      ) : null}

      {prompt ? (
        <>
          <span>Nothing has changed here for a while.</span>
          <button
            type="button"
            className="ok-chip"
            onClick={() => { setPrompt(false); snoozedUntil.current = Date.now() + SNOOZE_MS; }}
          >
            Not now — for 30 minutes
          </button>
        </>
      ) : null}
    </div>
  );
}
