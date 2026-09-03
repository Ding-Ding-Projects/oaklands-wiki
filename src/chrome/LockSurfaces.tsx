import { useEffect, useMemo, useState } from 'react';
import {
  POLICIES, hash, verifyTotp, markUnlocked, readLockout, registerFailure, clearLockout,
  type Factor, type Lock, type Policy,
} from '../lib/locks';
import type { VisitorState } from '../lib/visitor-state';
import { UnlockLadder } from './UnlockLadder';

/* ------------------------------------------------------------------ wizard */

/**
 * The lock wizard, anchored to the element it locks.
 *
 * It names the exact target, chooses ONE policy, creates that element's own
 * credentials, and returns focus to where it came from. Nothing is shared: two
 * elements locked with the same PIN got there because somebody typed it twice.
 */
export function LockWizard({
  target, label, onCreate, onClose,
}: {
  target: string;
  label: string;
  onCreate: (lock: Lock) => void;
  onClose: () => void;
}) {
  const [policy, setPolicy] = useState<Policy>('pin');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState('');
  const [duration, setDuration] = useState(15);
  const [acknowledged, setAcknowledged] = useState(false);
  const factors = POLICIES.find((p) => p.id === policy)?.factors ?? [];

  const ready =
    acknowledged &&
    (!factors.includes('pin') || /^\d{4,10}$/.test(pin)) &&
    (!factors.includes('password') || password.length >= 4) &&
    (!factors.includes('totp') || secret.replace(/\s+/g, '').length >= 16);

  const create = async () => {
    const lock: Lock = {
      target, label, policy, createdAt: new Date().toISOString(), durationMinutes: duration,
    };
    if (factors.includes('pin')) lock.pinHash = await hash(pin, target);
    if (factors.includes('password')) lock.passwordHash = await hash(password, target);
    if (factors.includes('totp')) lock.totpSecret = secret.replace(/\s+/g, '').toUpperCase();
    onCreate(lock);
  };

  return (
    <div className="ok-sheet" role="dialog" aria-label={`Lock ${label}`}>
      <div className="ok-sheet__head">
        <h2>Lock this element</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Cancel</button>
      </div>

      <p className="ok-muted">Locking: <strong>{label}</strong></p>

      <div className="ok-note">
        <p style={{ margin: 0 }}>
          <strong>This is just for fun.</strong> It is a self-imposed speed bump, not
          encryption, and it protects nothing from anyone else using this browser. If you
          forget the credential, clear this site&rsquo;s storage — there is no reset ticket and
          no support channel, because there is nothing to reset on any server.
        </p>
      </div>

      <div className="ok-settings">
        <div className="ok-field">
          <label className="ok-field__label" htmlFor="lock-policy">How it unlocks</label>
          <select id="lock-policy" value={policy} onChange={(event) => setPolicy(event.target.value as Policy)}>
            {POLICIES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
        </div>

        {factors.includes('pin') ? (
          <div className="ok-field">
            <label className="ok-field__label" htmlFor="lock-pin">PIN (4–10 digits)</label>
            <input id="lock-pin" type="password" inputMode="numeric" autoComplete="new-password"
              value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 10))} />
          </div>
        ) : null}

        {factors.includes('password') ? (
          <div className="ok-field">
            <label className="ok-field__label" htmlFor="lock-password">Password</label>
            <input id="lock-password" type="password" autoComplete="new-password"
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
        ) : null}

        {factors.includes('totp') ? (
          <div className="ok-field">
            <label className="ok-field__label" htmlFor="lock-totp">Authenticator secret (base32)</label>
            <input id="lock-totp" type="text" spellCheck={false} value={secret}
              onChange={(event) => setSecret(event.target.value)} />
            <p className="ok-field__hint">
              Paste a secret from your own authenticator. Nothing is generated, mailed or texted
              here, and no code is ever written to a log.
            </p>
          </div>
        ) : null}

        <div className="ok-field">
          <label className="ok-field__label" htmlFor="lock-duration">An unlock lasts</label>
          <select id="lock-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
            <option value={0}>This surface only</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={60}>1 hour</option>
            <option value={-1}>Until the browser closes</option>
          </select>
        </div>

        <label className="ok-switch">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          <span>I understand this is a toy lock and clearing site storage removes it</span>
        </label>

        <button type="button" disabled={!ready} onClick={create}>Lock it</button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- unlock */

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Back'];

export function UnlockPrompt({
  lock, state, onUnlocked, onClose,
}: {
  lock: Lock;
  state: VisitorState;
  onUnlocked: () => void;
  onClose: () => void;
}) {
  const factors = useMemo(() => POLICIES.find((p) => p.id === lock.policy)?.factors ?? [], [lock.policy]);
  const [step, setStep] = useState(0);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockout, setLockout] = useState(() => readLockout(lock.target));
  const [ladder, setLadder] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const waiting = lockout.until > now;
  const factor: Factor | undefined = factors[step];

  const check = async () => {
    if (!factor) return;
    let ok = false;
    if (factor === 'pin') ok = lock.pinHash === (await hash(value, lock.target));
    if (factor === 'password') ok = lock.passwordHash === (await hash(value, lock.target));
    if (factor === 'totp') ok = lock.totpSecret ? await verifyTotp(lock.totpSecret, value) : false;

    if (!ok) {
      const next = attempts + 1;
      setAttempts(next);
      setValue('');
      // Feedback never characterises the stored value — not its length, not its
      // composition, not how close the attempt was.
      setError('That did not match.');
      setLockout(registerFailure(lock.target, next));
      // A multi-factor policy keeps verified factors only for the current attempt.
      setStep(0);
      return;
    }

    setError(null);
    setValue('');
    if (step + 1 < factors.length) { setStep(step + 1); return; }
    clearLockout(lock.target);
    markUnlocked(lock.target, lock.durationMinutes);
    onUnlocked();
  };

  if (ladder) {
    return (
      <UnlockLadder
        target={lock.target}
        state={state}
        onCleared={() => { setLadder(false); setLockout(readLockout(lock.target)); setAttempts(0); }}
        onClose={() => setLadder(false)}
      />
    );
  }

  return (
    <div className="ok-sheet" role="dialog" aria-label={`Unlock ${lock.label}`}>
      <div className="ok-sheet__head">
        <h2>Locked: {lock.label}</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Cancel</button>
      </div>

      {waiting ? (
        <>
          <p className="ok-note">
            Too many wrong attempts. This unlocks again in{' '}
            <strong>{Math.ceil((lockout.until - now) / 1000)}s</strong>.
          </p>
          <button type="button" onClick={() => setLadder(true)}>Play instead of waiting</button>
        </>
      ) : (
        <>
          <p className="ok-muted">
            Step {step + 1} of {factors.length}: {factor === 'pin' ? 'PIN' : factor === 'password' ? 'password' : 'one-time code'}
          </p>

          <input
            type={factor === 'password' ? 'password' : 'text'}
            inputMode={factor === 'password' ? 'text' : 'numeric'}
            autoFocus
            value={value}
            aria-label={factor === 'pin' ? 'PIN' : factor === 'password' ? 'Password' : 'One-time code'}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void check(); }}
          />

          {/* A keypad AND manual entry, both feeding the same validator and the
              same attempt budget — two routes must never disagree. */}
          {factor !== 'password' ? (
            <div className="ok-keypad">
              {KEYPAD.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === 'Clear') setValue('');
                    else if (key === 'Back') setValue((v) => v.slice(0, -1));
                    else setValue((v) => (v + key).slice(0, 10));
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          ) : null}

          <button type="button" onClick={() => void check()} style={{ marginBlockStart: 'var(--ok-space-3)' }}>
            Unlock
          </button>

          {error ? <p className="ok-field__hint" role="alert">{error}</p> : null}

          <p className="ok-field__hint">
            Forgotten it? That is a normal outcome for a toy lock. Clear this site&rsquo;s storage
            to remove every lock — or open <strong>Support Tickets</strong> from the chrome bar,
            which does the same thing with more ceremony.
          </p>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------- support tickets */

/**
 * Support Tickets — the recovery route, dressed as a service desk.
 *
 * It plays the part properly and then does the only thing that works: it tells
 * you exactly which storage to clear. The disclosure below is deliberately
 * unstyled by the funny level, because a person must never sit waiting for a
 * reply that was never coming.
 */
export function SupportTickets({ onClose, onClearAll }: { onClose: () => void; onClearAll: () => void }) {
  const [category, setCategory] = useState('Locked out of my own element');
  const [description, setDescription] = useState('');
  const [ticket, setTicket] = useState<{ id: string; at: Date } | null>(null);
  const [stage, setStage] = useState(0);

  const raise = () => {
    setTicket({ id: `OAK-${Math.floor(Math.random() * 90000 + 10000)}`, at: new Date() });
    setStage(1);
    window.setTimeout(() => setStage(2), 1800);
  };

  return (
    <div className="ok-sheet" role="dialog" aria-label="Support Tickets">
      <div className="ok-sheet__head">
        <h2>Support Tickets</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>

      <div className="ok-note">
        <p style={{ margin: 0 }}>
          Nothing here is sent anywhere. No ticket exists outside this browser, no network
          request is made, no data is collected, and nobody is reading it. This is a joke with
          a working button at the end of it.
        </p>
      </div>

      {!ticket ? (
        <div className="ok-settings">
          <div className="ok-field">
            <label className="ok-field__label" htmlFor="ticket-category">Category</label>
            <select id="ticket-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>Locked out of my own element</option>
              <option>Forgot a PIN I set four minutes ago</option>
              <option>Authenticator is on the phone that is locked</option>
              <option>Other</option>
            </select>
          </div>
          <div className="ok-field">
            <label className="ok-field__label" htmlFor="ticket-body">Describe the issue</label>
            <textarea id="ticket-body" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <button type="button" onClick={raise}>Raise ticket</button>
        </div>
      ) : (
        <div className="ok-settings">
          <p><strong>Ticket {ticket.id}</strong> · raised {ticket.at.toLocaleTimeString()} · severity: <em>P1 — Critical</em></p>
          {stage < 2 ? (
            <p className="ok-muted">An agent is reviewing your ticket…</p>
          ) : (
            <>
              <blockquote>
                <p>
                  Thank you for contacting Support. Having reviewed your case thoroughly, our
                  records indicate the credential is stored exclusively in your own browser, and
                  we regret that no copy exists on our side to recover.
                </p>
                <p>
                  Please find below the resolution. We trust this brings the matter to a
                  satisfactory close.
                </p>
              </blockquote>
              <div className="ok-field">
                <span className="ok-field__label">Resolution</span>
                <p className="ok-field__hint">
                  Clearing this site&rsquo;s storage removes every lock, every setting and every
                  ticket — including this one, which is either a design flaw or the funniest part,
                  depending on your funny level.
                </p>
                <button type="button" onClick={onClearAll}>Clear this site&rsquo;s storage now</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
