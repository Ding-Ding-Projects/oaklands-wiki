/**
 * Toy locks for any rendered element.
 *
 * **It is just for fun, and every surface says so.** This is a self-imposed
 * speed bump in the same sense School mode is. It is not encryption, it does not
 * secure anything, and it is no protection at all from anyone else who has this
 * browser. Never describe it otherwise.
 *
 * Recovery is self-service by design: clearing this site's storage removes every
 * lock. Forgetting a PIN is a normal outcome for a toy, so there is no reset
 * ticket, no account and no support channel — and the unlock prompt says exactly
 * that rather than implying one exists.
 *
 * Each lock carries its OWN policy and its OWN credentials. There is no master
 * credential and no inheritance: unlocking one element never unlocks another.
 */

export type Policy =
  | 'pin'
  | 'password'
  | 'pin+password'
  | 'password+totp'
  | 'pin+totp'
  | 'password+pin+totp';

export const POLICIES: { id: Policy; label: string; factors: Factor[] }[] = [
  { id: 'pin', label: 'PIN', factors: ['pin'] },
  { id: 'password', label: 'Password', factors: ['password'] },
  { id: 'pin+password', label: 'PIN, then password', factors: ['pin', 'password'] },
  { id: 'password+totp', label: 'Password, then one-time code', factors: ['password', 'totp'] },
  { id: 'pin+totp', label: 'PIN, then one-time code', factors: ['pin', 'totp'] },
  { id: 'password+pin+totp', label: 'Password, PIN, then one-time code', factors: ['password', 'pin', 'totp'] },
];

export type Factor = 'pin' | 'password' | 'totp';

export type Lock = {
  /** A stable identity for the locked element. */
  target: string;
  label: string;
  policy: Policy;
  /** Hashes only. A password is verified against a hash, never a stored password. */
  pinHash?: string;
  passwordHash?: string;
  totpSecret?: string;
  createdAt: string;
  /** How long an unlock lasts: 0 = this surface only, n = minutes, -1 = until close. */
  durationMinutes: number;
};

export type LockStore = Record<string, Lock>;

const KEY = 'oaklands.locks.v1';
const UNLOCK_KEY = 'oaklands.unlocked.v1';
const LOCKOUT_KEY = 'oaklands.lockout.v1';

/** SHA-256 hex. Verification compares hashes; nothing stores a secret in the clear. */
export async function hash(value: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function loadLocks(): LockStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as LockStore) : {};
  } catch { return {}; }
}

export function saveLocks(store: LockStore): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* not remembered */ }
}

/** A stable identity for an element: its own id, or a structural path. */
export function targetOf(element: Element): string {
  if (element.id) return `#${element.id}`;
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body && parts.length < 8) {
    const parent: Element | null = node.parentElement;
    const index = parent ? [...parent.children].indexOf(node) : 0;
    parts.unshift(`${node.tagName.toLowerCase()}:${index}`);
    node = parent;
  }
  return parts.join('>');
}

/* ------------------------------------------------------------- unlock state */

type UnlockRecord = Record<string, number>; // target -> expiry epoch ms, 0 = session

function readUnlocks(): UnlockRecord {
  try {
    const raw = window.sessionStorage.getItem(UNLOCK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function isUnlocked(target: string): boolean {
  const record = readUnlocks()[target];
  if (record === undefined) return false;
  return record === 0 || Date.now() < record;
}

export function markUnlocked(target: string, durationMinutes: number): void {
  const record = readUnlocks();
  // -1 means until the browser closes, which sessionStorage already gives us.
  record[target] = durationMinutes <= 0 ? 0 : Date.now() + durationMinutes * 60_000;
  try { window.sessionStorage.setItem(UNLOCK_KEY, JSON.stringify(record)); } catch { /* this visit only */ }
}

export function relock(target: string): void {
  const record = readUnlocks();
  delete record[target];
  try { window.sessionStorage.setItem(UNLOCK_KEY, JSON.stringify(record)); } catch { /* nothing to undo */ }
}

/* ----------------------------------------------------------------- lockouts */

export type Lockout = { until: number; consecutive: number; ladderUsedAt: number[] };

export function readLockout(target: string): Lockout {
  try {
    const raw = window.localStorage.getItem(`${LOCKOUT_KEY}:${target}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return { until: 0, consecutive: 0, ladderUsedAt: [] };
    return {
      until: Number(parsed.until) || 0,
      consecutive: Number(parsed.consecutive) || 0,
      ladderUsedAt: Array.isArray(parsed.ladderUsedAt) ? parsed.ladderUsedAt.map(Number) : [],
    };
  } catch { return { until: 0, consecutive: 0, ladderUsedAt: [] }; }
}

function writeLockout(target: string, value: Lockout): void {
  try { window.localStorage.setItem(`${LOCKOUT_KEY}:${target}`, JSON.stringify(value)); } catch { /* not remembered */ }
}

/**
 * Register a wrong attempt.
 *
 * The wait lengthens exponentially with each consecutive lockout and is capped.
 * Clearing the ladder skips a wait; it never slows this escalation down.
 */
export function registerFailure(target: string, attemptsInWindow: number): Lockout {
  const current = readLockout(target);
  if (attemptsInWindow < 5) return current;
  const consecutive = current.consecutive + 1;
  const waitMs = Math.min(2 ** consecutive * 5000, 15 * 60 * 1000);
  const next: Lockout = { until: Date.now() + waitMs, consecutive, ladderUsedAt: current.ladderUsedAt };
  writeLockout(target, next);
  return next;
}

export function clearLockout(target: string): void {
  writeLockout(target, { until: 0, consecutive: 0, ladderUsedAt: readLockout(target).ladderUsedAt });
}

/** The ladder's budget: at most this many skipped waits per rolling hour. */
export const LADDER_BUDGET = 3;
const LADDER_WINDOW_MS = 60 * 60 * 1000;

export function ladderRemaining(target: string): number {
  const { ladderUsedAt } = readLockout(target);
  const recent = ladderUsedAt.filter((at) => Date.now() - at < LADDER_WINDOW_MS);
  return Math.max(0, LADDER_BUDGET - recent.length);
}

/**
 * Spend one ladder win.
 *
 * This is what makes the ladder safe rather than merely clever. Four choices is
 * one-in-four and a mole schedule is arithmetic, so without a cap a script could
 * play its way past every lockout and brute force would get cheaper — which is
 * the single thing a lockout exists to prevent.
 *
 * It clears the WAIT and nothing else: no credential is refunded, no attempt
 * budget is topped up, and the exponential escalation is untouched.
 */
export function spendLadderWin(target: string): boolean {
  const current = readLockout(target);
  const recent = current.ladderUsedAt.filter((at) => Date.now() - at < LADDER_WINDOW_MS);
  if (recent.length >= LADDER_BUDGET) return false;
  writeLockout(target, { until: 0, consecutive: current.consecutive, ladderUsedAt: [...recent, Date.now()] });
  return true;
}

/* --------------------------------------------------------------------- TOTP */

function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  // An explicitly ArrayBuffer-backed view: WebCrypto's BufferSource excludes
  // SharedArrayBuffer, and the default Uint8Array type admits both.
  const buffer = new Uint8Array(new ArrayBuffer(out.length));
  buffer.set(out);
  return buffer;
}

/**
 * RFC 6238 TOTP over RFC 4226 HOTP.
 *
 * A small clock-skew window is allowed, because a device whose clock is a minute
 * out is the commonest reason a correct code is rejected — and an authenticator
 * that is subtly wrong produces codes rejected everywhere with no error to read.
 */
export async function verifyTotp(secret: string, code: string, skewSteps = 1): Promise<boolean> {
  const digits = code.replace(/\s+/g, '');
  if (!/^\d{6,8}$/.test(digits)) return false;
  const key = base32Decode(secret);
  if (key.length === 0) return false;

  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const counter = Math.floor(Date.now() / 1000 / 30);

  for (let offset = -skewSteps; offset <= skewSteps; offset += 1) {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, counter + offset);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, buffer));
    const bucket = signature[signature.length - 1] & 0x0f;
    const binary =
      ((signature[bucket] & 0x7f) << 24) |
      ((signature[bucket + 1] & 0xff) << 16) |
      ((signature[bucket + 2] & 0xff) << 8) |
      (signature[bucket + 3] & 0xff);
    const expected = (binary % 10 ** digits.length).toString().padStart(digits.length, '0');
    if (expected === digits) return true;
  }
  return false;
}
