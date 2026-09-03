import { useCallback, useMemo, useState } from 'react';
import {
  loadHistory, record, clearHistory, EXPORT_FORMATS, serialise, download,
  type HistoryEntry, type HistoryAction, type ExportFormat,
} from '../lib/history';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';

/**
 * The history panel.
 *
 * Filterable, because a history nobody can search is an archive nobody opens: a
 * date range, an action filter derived from the entries themselves rather than a
 * hard-coded list that drifts, and a text search with its own regex builder.
 * All three compose; none overrides another.
 */
export function HistoryPanel({
  onRestore, onClose,
}: {
  onRestore: (entry: HistoryEntry) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory());
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actions, setActions] = useState<Set<HistoryAction>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>('json');
  const [confirmClear, setConfirmClear] = useState(0);

  // Derived from the entries, so a new action kind appears here automatically
  // rather than being missing from a hard-coded list nobody remembered to update.
  const actionCounts = useMemo(() => {
    const counts = new Map<HistoryAction, number>();
    for (const entry of entries) counts.set(entry.action, (counts.get(entry.action) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const narrowed = useMemo(
    () =>
      entries.filter((entry) => {
        if (actions.size > 0 && !actions.has(entry.action)) return false;
        const at = entry.at.slice(0, 10);
        if (from && at < from) return false;
        if (to && at > to) return false;
        return true;
      }),
    [entries, actions, from, to],
  );

  const textOf = useCallback((entry: HistoryEntry) => `${entry.subject} ${entry.summary} ${entry.action}`, []);
  const { results, error } = useSearchFilter(narrowed, query, mode, flags, textOf);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const chosen = results.filter((entry) => selected.has(entry.id));
  const exporting = chosen.length > 0 ? chosen : results;

  const doExport = () => {
    const spec = EXPORT_FORMATS.find((f) => f.id === format)!;
    const rows = exporting.map((entry) => ({
      at: entry.at, action: entry.action, subject: entry.subject, summary: entry.summary,
    }));
    download(serialise(rows, format, 'Oaklands Wiki history'), `oaklands-history.${spec.extension}`, spec.mime);
  };

  const restore = (entry: HistoryEntry) => {
    onRestore(entry);
    // Append-only: restoring is a NEW entry, so this undo can itself be undone.
    record({ action: 'restored', subject: entry.subject, summary: `Restored the state from ${entry.at}`, snapshot: entry.snapshot });
    setEntries(loadHistory());
  };

  return (
    <div className="ok-sheet ok-sheet--wide" role="dialog" aria-label="History">
      <div className="ok-sheet__head">
        <h2>History</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>

      <p className="ok-muted">
        Append-only. Restoring adds a new entry rather than rewriting one, so an undo can be
        undone. Nothing here leaves this browser, and no credential is ever recorded.
      </p>

      <SearchWithRegex
        label="Search history"
        query={query} onQuery={setQuery}
        mode={mode} onMode={setMode} flags={flags} onFlags={setFlags}
        error={error} resultCount={results.length} totalCount={entries.length}
      />

      <div className="ok-filters">
        <div className="ok-filter">
          <label className="ok-eyebrow" htmlFor="hist-from">From</label>
          <input id="hist-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="ok-filter">
          <label className="ok-eyebrow" htmlFor="hist-to">To</label>
          <input id="hist-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="ok-filter">
          <p className="ok-eyebrow" id="hist-actions">Action</p>
          <div className="ok-filter__chips" role="group" aria-labelledby="hist-actions">
            {actionCounts.map(([action, count]) => (
              <button
                key={action}
                type="button"
                className="ok-chip"
                aria-pressed={actions.has(action)}
                onClick={() =>
                  setActions((current) => {
                    const next = new Set(current);
                    if (next.has(action)) next.delete(action); else next.add(action);
                    return next;
                  })
                }
              >
                {action} <span className="ok-muted">({count})</span>
              </button>
            ))}
            {actionCounts.length === 0 ? <span className="ok-muted">No entries yet.</span> : null}
          </div>
        </div>
      </div>

      {/* Bulk actions. Select-all states its scope explicitly rather than
          leaving "all" to mean whichever of the two the reader assumed. */}
      <div className="ok-bulkbar">
        <button type="button" className="ok-chip" onClick={() => setSelected(new Set(results.map((e) => e.id)))}>
          Select all {results.length} matching
        </button>
        <button type="button" className="ok-chip" onClick={() => setSelected(new Set(entries.map((e) => e.id)))}>
          Select all {entries.length} entries
        </button>
        <button
          type="button" className="ok-chip"
          onClick={() => setSelected(new Set(results.filter((e) => !selected.has(e.id)).map((e) => e.id)))}
        >
          Invert
        </button>
        <button type="button" className="ok-chip" onClick={() => setSelected(new Set())}>Clear selection</button>
        <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} aria-label="Export format">
          {EXPORT_FORMATS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
        <button type="button" onClick={doExport}>
          Export {exporting.length} {chosen.length > 0 ? 'selected' : 'shown'}
        </button>
      </div>

      <ul className="ok-rows" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        {results.map((entry) => (
          <li key={entry.id}>
            <div className="ok-row" style={{ cursor: 'default' }}>
              <input
                type="checkbox"
                aria-label={`Select ${entry.subject}`}
                checked={selected.has(entry.id)}
                onChange={() => toggle(entry.id)}
              />
              <span className="ok-row__name">
                <strong>{entry.subject}</strong>
                <span className="ok-muted"> — {entry.summary}</span>
              </span>
              <span className="ok-row__meta">
                {entry.action} · {new Date(entry.at).toLocaleString()}
              </span>
              {entry.snapshot !== undefined ? (
                <button type="button" className="ok-chip" onClick={() => restore(entry)}>Restore</button>
              ) : null}
            </div>
          </li>
        ))}
        {results.length === 0 ? (
          <li className="ok-muted">
            {entries.length === 0
              ? 'Nothing recorded yet. Changing a setting or a lock adds an entry here.'
              : 'No entry matches these filters.'}
          </li>
        ) : null}
      </ul>

      <div className="ok-field" style={{ marginBlockStart: 'var(--ok-space-5)' }}>
        <span className="ok-field__label">Clear the history</span>
        <p className="ok-field__hint">Irreversible, and it does not undo any of the changes it recorded.</p>
        {confirmClear === 0 ? (
          <button type="button" onClick={() => setConfirmClear(1)}>Clear history…</button>
        ) : confirmClear === 1 ? (
          <>
            <button type="button" onClick={() => setConfirmClear(2)}>I understand — continue</button>{' '}
            <button type="button" onClick={() => setConfirmClear(0)}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => { clearHistory(); setEntries([]); setConfirmClear(0); }}>Clear now</button>{' '}
            <button type="button" onClick={() => setConfirmClear(0)}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
