import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadRules, saveRules, resolve, type Rule, type Source,
} from '../lib/schedule';

/**
 * Scheduled settings.
 *
 * A rule can select a date range, a time window, every day or an explicit set of
 * weekdays, and set any appearance or language value when it matches. Values may
 * come from the rule itself, from a validated HTTPS endpoint, or from a Home
 * Assistant boolean entity.
 *
 * Semantics that are decided here rather than guessed at:
 *
 * - Times are interpreted in the visitor's own timezone, which is named on the
 *   surface so nobody has to infer it.
 * - A window that crosses midnight is two intervals, not an empty one.
 * - Equal start and end means the whole day, because a zero-length window is
 *   never what anybody meant by typing the same time twice.
 * - When several rules match, the LAST enabled one wins, and the surface says so
 *   rather than leaving precedence to array order nobody can see.
 * - The base settings are never overwritten: a schedule is an overlay, and
 *   turning every rule off returns exactly what was there before.
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduledSettings({
  onApply, onClose,
}: {
  onApply: (values: Rule['values'] | null) => void;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  useEffect(() => { setRules(loadRules()); }, []);
  useEffect(() => {
    saveRules(rules);
  }, [rules]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const active = useMemo(() => resolve(rules, now), [rules, now]);
  useEffect(() => { onApply(active?.values ?? null); }, [active, onApply]);

  const update = (id: string, patch: Partial<Rule>) =>
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  const addRule = () =>
    setRules((current) => [...current, {
      id: `r${Date.now()}`, label: `Rule ${current.length + 1}`, enabled: true,
      days: [], startTime: '20:00', endTime: '07:00', startDate: null, endDate: null,
      source: { kind: 'local' }, values: { theme: 'dark' },
    }]);

  const testSource = useCallback(async (rule: Rule) => {
    if (rule.source.kind === 'local') { setStatus('This rule uses its own values; there is nothing to fetch.'); return; }
    try {
      const url = rule.source.kind === 'https'
        ? rule.source.url
        : `${rule.source.baseUrl.replace(/\/$/, '')}/api/states/${encodeURIComponent(rule.source.entity)}`;
      if (!/^https:\/\//.test(url)) { setStatus('Refused: the endpoint must be HTTPS.'); return; }
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (!response.ok) { setStatus(`The source answered HTTP ${response.status}. The last local value stays in effect.`); return; }
      const body = await response.text();
      if (body.length > 64 * 1024) { setStatus('Refused: the response is larger than the 64 KiB bound.'); return; }
      setStatus(`Reachable. ${body.slice(0, 80)}${body.length > 80 ? '…' : ''}`);
    } catch (error) {
      // A failure is non-blocking and fails safe: the local base state remains.
      setStatus(`Could not reach the source (${error instanceof Error ? error.message : 'unknown'}). Your local settings are unchanged.`);
    }
  }, []);

  return (
    <div className="ok-sheet ok-sheet--wide" role="dialog" aria-label="Scheduled settings">
      <div className="ok-sheet__head">
        <h2>Scheduled settings</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>

      <p className="ok-muted">
        Times are in <strong>{timezone}</strong>, your own timezone, and follow its daylight
        saving. A window that crosses midnight is handled; equal start and end means the whole
        day. When several rules match, <strong>the last enabled one wins</strong>.
      </p>

      <p className="ok-note">
        {active
          ? <>Right now <strong>{active.label}</strong> is applying: {Object.entries(active.values).map(([k, v]) => `${k} = ${String(v)}`).join(', ')}.</>
          : 'No rule matches right now, so your ordinary settings are in effect.'}
      </p>

      {rules.map((rule) => (
        <div key={rule.id} className="ok-schedrule">
          <div className="ok-field">
            <label className="ok-switch">
              <input type="checkbox" checked={rule.enabled} onChange={(event) => update(rule.id, { enabled: event.target.checked })} />
              <input type="text" value={rule.label} aria-label="Rule name"
                onChange={(event) => update(rule.id, { label: event.target.value })} />
            </label>
          </div>

          <div className="ok-field">
            <span className="ok-field__label">Days</span>
            <div className="ok-filter__chips">
              <button type="button" className="ok-chip" aria-pressed={rule.days.length === 0}
                onClick={() => update(rule.id, { days: [] })}>
                Every day
              </button>
              {DAY_NAMES.map((name, index) => (
                <button key={name} type="button" className="ok-chip" aria-pressed={rule.days.includes(index)}
                  onClick={() => update(rule.id, {
                    days: rule.days.includes(index) ? rule.days.filter((d) => d !== index) : [...rule.days, index],
                  })}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="ok-filters">
            <div className="ok-filter">
              <label className="ok-eyebrow" htmlFor={`${rule.id}-start`}>From</label>
              <input id={`${rule.id}-start`} type="time" value={rule.startTime}
                onChange={(event) => update(rule.id, { startTime: event.target.value })} />
            </div>
            <div className="ok-filter">
              <label className="ok-eyebrow" htmlFor={`${rule.id}-end`}>Until</label>
              <input id={`${rule.id}-end`} type="time" value={rule.endTime}
                onChange={(event) => update(rule.id, { endTime: event.target.value })} />
            </div>
            <div className="ok-filter">
              <label className="ok-eyebrow" htmlFor={`${rule.id}-from`}>Starting</label>
              <input id={`${rule.id}-from`} type="date" value={rule.startDate ?? ''}
                onChange={(event) => update(rule.id, { startDate: event.target.value || null })} />
            </div>
            <div className="ok-filter">
              <label className="ok-eyebrow" htmlFor={`${rule.id}-until`}>Ending</label>
              <input id={`${rule.id}-until`} type="date" value={rule.endDate ?? ''}
                onChange={(event) => update(rule.id, { endDate: event.target.value || null })} />
            </div>
          </div>

          <div className="ok-field">
            <label className="ok-field__label" htmlFor={`${rule.id}-theme`}>While it matches, set</label>
            <select id={`${rule.id}-theme`} value={rule.values.theme ?? ''}
              onChange={(event) => update(rule.id, { values: { ...rule.values, theme: (event.target.value || undefined) as 'dark' | 'light' | undefined } })}>
              <option value="">Leave the theme alone</option>
              <option value="dark">Dark theme</option>
              <option value="light">Light theme</option>
            </select>
            <select value={rule.values.density ?? ''}
              aria-label="Density while the rule matches"
              onChange={(event) => update(rule.id, { values: { ...rule.values, density: (event.target.value || undefined) as 'comfortable' | 'compact' | undefined } })}>
              <option value="">Leave the density alone</option>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </div>

          <div className="ok-field">
            <label className="ok-field__label" htmlFor={`${rule.id}-source`}>Value source</label>
            <select id={`${rule.id}-source`} value={rule.source.kind}
              onChange={(event) => {
                const kind = event.target.value as Source['kind'];
                update(rule.id, {
                  source: kind === 'https' ? { kind, url: '' }
                    : kind === 'homeAssistant' ? { kind, baseUrl: '', entity: '' }
                    : { kind: 'local' },
                });
              }}>
              <option value="local">This rule&rsquo;s own values</option>
              <option value="https">An HTTPS endpoint</option>
              <option value="homeAssistant">A Home Assistant boolean entity</option>
            </select>

            {rule.source.kind === 'https' ? (
              <input type="url" placeholder="https://…" value={rule.source.url}
                aria-label="HTTPS endpoint"
                onChange={(event) => update(rule.id, { source: { kind: 'https', url: event.target.value } })} />
            ) : null}

            {rule.source.kind === 'homeAssistant' ? (
              <>
                <input type="url" placeholder="https://home-assistant.local:8123" value={rule.source.baseUrl}
                  aria-label="Home Assistant base URL"
                  onChange={(event) => update(rule.id, { source: { ...rule.source as Extract<Source, { kind: 'homeAssistant' }>, baseUrl: event.target.value } })} />
                <input type="text" placeholder="input_boolean.night_mode" value={rule.source.entity}
                  aria-label="Entity id"
                  onChange={(event) => update(rule.id, { source: { ...rule.source as Extract<Source, { kind: 'homeAssistant' }>, entity: event.target.value } })} />
                <p className="ok-field__hint">
                  A token is <strong>never</strong> stored here. This browser has no credential
                  vault, so an authenticated endpoint will answer 401 and the rule falls back to
                  your local values — which is stated rather than retried silently.
                </p>
              </>
            ) : null}

            {rule.source.kind !== 'local' ? (
              <button type="button" className="ok-chip" onClick={() => void testSource(rule)}>Test this source</button>
            ) : null}
          </div>

          <button type="button" className="ok-chip"
            onClick={() => setRules((current) => current.filter((r) => r.id !== rule.id))}>
            Remove this rule
          </button>
        </div>
      ))}

      {status ? <p className="ok-note" role="status">{status}</p> : null}

      <button type="button" style={{ marginBlockStart: 'var(--ok-space-4)' }} onClick={addRule}>Add a rule</button>

      {rules.length === 0 ? (
        <p className="ok-field__hint">
          No rules yet. A common one: dark theme from 20:00 until 07:00, every day.
        </p>
      ) : null}
    </div>
  );
}
