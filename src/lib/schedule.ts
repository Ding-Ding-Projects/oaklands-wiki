/**
 * Schedule rules: the pure half.
 *
 * Kept out of the component so every boundary can be driven without a clock and
 * without a browser — which is the only practical way to test a window that
 * crosses midnight.
 */
import type { VisitorState } from './visitor-state';

export type Source =
  | { kind: 'local' }
  | { kind: 'https'; url: string }
  | { kind: 'homeAssistant'; baseUrl: string; entity: string };

export type Rule = {
  id: string;
  label: string;
  enabled: boolean;
  days: number[];            // 0 = Sunday. Empty means every day.
  startTime: string;         // HH:MM
  endTime: string;
  startDate: string | null;  // YYYY-MM-DD
  endDate: string | null;
  source: Source;
  /** The settings this rule applies while it matches. */
  values: Partial<Pick<VisitorState, 'theme' | 'density' | 'language' | 'accent' | 'reduceMotion'>>;
};

const KEY = 'oaklands.schedule.v1';

export function loadRules(): Rule[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveRules(rules: Rule[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(rules)); } catch { /* not remembered */ }
}

const minutes = (time: string): number | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number(match[1]); const m = Number(match[2]);
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : null;
};

/**
 * Does a rule match a given moment? Pure, so the tests can drive every boundary
 * without waiting for a clock.
 */
export function matches(rule: Rule, at: Date): boolean {
  if (!rule.enabled) return false;

  const date = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  if (rule.startDate && date < rule.startDate) return false;
  if (rule.endDate && date > rule.endDate) return false;

  // An empty day list means every day, rather than no days — "every day" is the
  // common case and an empty selection is what a fresh rule starts with.
  if (rule.days.length > 0 && !rule.days.includes(at.getDay())) return false;

  const start = minutes(rule.startTime);
  const end = minutes(rule.endTime);
  if (start === null || end === null) return false;
  const now = at.getHours() * 60 + at.getMinutes();

  if (start === end) return true;                 // the whole day
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;               // crosses midnight
}

/** The last enabled matching rule wins, and precedence is stated on the surface. */
export function resolve(rules: Rule[], at: Date): Rule | null {
  const hits = rules.filter((rule) => matches(rule, at));
  return hits.length > 0 ? hits[hits.length - 1] : null;
}

