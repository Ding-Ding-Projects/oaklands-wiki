import { useCallback, useEffect, useMemo, useState } from 'react';
import { encodeQr, otpauthUri } from '../lib/qr';
import { verifyTotp } from '../lib/locks';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';

/**
 * A local authenticator.
 *
 * Not only for this site's own factors: a place to keep arbitrary TOTP secrets
 * and read live codes. Local, with no account, no sync, no network and no
 * telemetry.
 *
 * Registration shows a QR **drawn in this process**. Never a QR web service or a
 * remote chart API: rendering a pairing secret through somebody else's server
 * would hand them the secret on the way to drawing it.
 */

export type Entry = { id: string; issuer: string; account: string; secret: string; digits: number; period: number };

const KEY = 'oaklands.authenticator.v1';

function load(): Entry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function save(entries: Entry[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* not remembered */ }
}

/** Generate a code for display. Same algorithm the verifier uses. */
async function currentCode(entry: Entry, offsetSteps = 0): Promise<string> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const char of entry.secret.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  if (bytes.length === 0) return '—'.repeat(entry.digits);
  const keyBuffer = new Uint8Array(new ArrayBuffer(bytes.length));
  keyBuffer.set(bytes);
  const key = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = Math.floor(Date.now() / 1000 / entry.period) + offsetSteps;
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setUint32(4, counter);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) | ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) | (mac[offset + 3] & 0xff);
  return (binary % 10 ** entry.digits).toString().padStart(entry.digits, '0');
}

export function Authenticator({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [codes, setCodes] = useState<Record<string, { now: string; next: string }>>({});
  const [seconds, setSeconds] = useState(30);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');
  const [skew, setSkew] = useState<number | null>(null);

  useEffect(() => { setEntries(load()); }, []);
  useEffect(() => { save(entries); }, [entries]);

  // The clock is the failure nobody diagnoses: codes come from the system clock,
  // and when it is skewed the codes are confidently wrong with nothing to read.
  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
        const header = response.headers.get('date');
        if (!header) return;
        setSkew(Math.round((Date.now() - new Date(header).getTime()) / 1000));
      } catch { /* offline: no skew claim rather than a guessed one */ }
    };
    void check();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next: Record<string, { now: string; next: string }> = {};
      for (const entry of entries) {
        next[entry.id] = { now: await currentCode(entry), next: await currentCode(entry, 1) };
      }
      if (!cancelled) setCodes(next);
    };
    void refresh();
    const timer = window.setInterval(() => {
      setSeconds(30 - (Math.floor(Date.now() / 1000) % 30));
      void refresh();
    }, 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [entries]);

  const textOf = useCallback((entry: Entry) => `${entry.issuer} ${entry.account}`, []);
  const { results, error } = useSearchFilter(entries, query, mode, flags, textOf);

  return (
    <div className="ok-sheet ok-sheet--wide" role="dialog" aria-label="Authenticator">
      <div className="ok-sheet__head">
        <h2>Authenticator</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>

      <p className="ok-muted">
        Local only: no account, no sync, no network. RFC 6238 TOTP over RFC 4226 HOTP.
        {skew !== null && Math.abs(skew) > 30 ? (
          <>
            {' '}<strong>This computer&rsquo;s clock is about {Math.abs(skew)}s{' '}
            {skew > 0 ? 'ahead of' : 'behind'} the server.</strong> Codes will be rejected until
            it is corrected — they are generated from the clock, not from anything we control.
          </>
        ) : null}
      </p>

      <SearchWithRegex
        label="Search entries"
        query={query} onQuery={setQuery} mode={mode} onMode={setMode}
        flags={flags} onFlags={setFlags} error={error}
        resultCount={results.length} totalCount={entries.length}
      />

      <ul className="ok-rows" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        {results.map((entry) => (
          <li key={entry.id}>
            <div className="ok-row" style={{ cursor: 'default' }}>
              <span className="ok-row__name">
                <strong>{entry.issuer}</strong>
                <span className="ok-muted"> · {entry.account}</span>
              </span>
              <output className="ok-code" aria-live="off">
                {(codes[entry.id]?.now ?? '—'.repeat(entry.digits)).replace(/(\d{3})(?=\d)/, '$1 ')}
              </output>
              <span className="ok-row__meta">
                {seconds}s · next {codes[entry.id]?.next ?? '—'}
              </span>
              <button type="button" className="ok-chip"
                onClick={() => void navigator.clipboard?.writeText(codes[entry.id]?.now ?? '')}>
                Copy
              </button>
              <button type="button" className="ok-chip"
                onClick={() => setEntries((current) => current.filter((e) => e.id !== entry.id))}>
                Remove
              </button>
            </div>
          </li>
        ))}
        {results.length === 0 ? (
          <li className="ok-muted">{entries.length === 0 ? 'No entries yet.' : 'Nothing matches.'}</li>
        ) : null}
      </ul>

      {adding ? (
        <AddEntry
          onAdd={(entry) => { setEntries((current) => [...current, entry]); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" style={{ marginBlockStart: 'var(--ok-space-4)' }} onClick={() => setAdding(true)}>
          Add an entry
        </button>
      )}

      <p className="ok-field__hint" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        Ordinary exports omit these secrets and say so. There is no bulk secrets export here;
        adding one would be a separate, explicitly named action behind the destructive-action
        gate, warning that it writes usable secrets in the clear.
      </p>
    </div>
  );
}

function AddEntry({ onAdd, onCancel }: { onAdd: (entry: Entry) => void; onCancel: () => void }) {
  const [issuer, setIssuer] = useState('Oaklands Wiki');
  const [account, setAccount] = useState('');
  const [secret, setSecret] = useState(() => randomSecret());
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const uri = useMemo(
    () => otpauthUri({ issuer, account: account || 'account', secret }),
    [issuer, account, secret],
  );
  const matrix = useMemo(() => encodeQr(uri), [uri]);

  const pair = async () => {
    // Confirm before the factor arms. Without this step a mistyped secret locks
    // somebody out of a thing they just set up, and they find out when they need it.
    if (await verifyTotp(secret, confirm)) onAdd({
      id: `a${Date.now()}`, issuer, account: account || 'account', secret, digits: 6, period: 30,
    });
    else setStatus('That code did not match. Check the clock on the device you scanned with.');
  };

  return (
    <div className="ok-settings" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
      <div className="ok-field">
        <label className="ok-field__label" htmlFor="auth-issuer">Issuer</label>
        <input id="auth-issuer" type="text" value={issuer} onChange={(event) => setIssuer(event.target.value)} />
      </div>
      <div className="ok-field">
        <label className="ok-field__label" htmlFor="auth-account">Account</label>
        <input id="auth-account" type="text" value={account} onChange={(event) => setAccount(event.target.value)} />
      </div>

      <div className="ok-field">
        <span className="ok-field__label">Scan this</span>
        {matrix ? (
          <QrCanvas matrix={matrix} label={`Pairing code for ${issuer}`} />
        ) : (
          <p className="ok-field__hint">This pairing URI is too long to encode here. Use the manual secret below.</p>
        )}
        <p className="ok-field__hint">
          Drawn in this browser. Nothing is sent to a QR service, because that would hand the
          secret to somebody else&rsquo;s server on the way to drawing it.
        </p>
      </div>

      <div className="ok-field">
        <span className="ok-field__label">Or enter it by hand</span>
        {revealed ? (
          <code style={{ wordBreak: 'break-all' }}>{secret.replace(/(.{4})/g, '$1 ').trim()}</code>
        ) : (
          <button type="button" onClick={() => setRevealed(true)}>Reveal the secret</button>
        )}
        <p className="ok-field__hint">SHA-1 · 6 digits · 30 seconds. Useful when pairing on this same device.</p>
        <button type="button" className="ok-chip" onClick={() => { setSecret(randomSecret()); setRevealed(false); }}>
          Generate a different secret
        </button>
      </div>

      <div className="ok-field">
        <label className="ok-field__label" htmlFor="auth-confirm">Confirm with a current code</label>
        <input id="auth-confirm" type="text" inputMode="numeric" value={confirm}
          onChange={(event) => setConfirm(event.target.value)} />
        {status ? <p className="ok-field__hint" role="alert">{status}</p> : null}
      </div>

      <div style={{ display: 'flex', gap: 'var(--ok-space-2)' }}>
        <button type="button" onClick={() => void pair()} disabled={confirm.length < 6}>Pair</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function randomSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map((b) => alphabet[b % 32]).join('');
}

function QrCanvas({ matrix, label }: { matrix: { size: number; modules: boolean[][] }; label: string }) {
  const scale = 5;
  const quiet = 4;
  const dimension = (matrix.size + quiet * 2) * scale;
  return (
    <svg
      role="img"
      aria-label={label}
      width={dimension}
      height={dimension}
      viewBox={`0 0 ${dimension} ${dimension}`}
      // True dark-on-light in both themes: tinting a QR into the palette is how
      // a scannable code stops scanning.
      style={{ background: '#ffffff', borderRadius: 'var(--ok-radius-sm)' }}
    >
      {matrix.modules.flatMap((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={(x + quiet) * scale}
              y={(y + quiet) * scale}
              width={scale}
              height={scale}
              fill="#000000"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
