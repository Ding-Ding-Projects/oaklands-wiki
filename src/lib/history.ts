/**
 * Append-only local history for visitor-owned state.
 *
 * Every creation, change and removal is a new entry. **Restoring is itself
 * recorded as a new entry, never a rewrite**, so an undo can be undone and that
 * undo undone in turn. A "restore" that discards the branch it replaced is the
 * one failure mode that makes a history panel unsafe to use, because you cannot
 * experiment without risking the state you started from.
 *
 * It records what CHANGED, not that something did: "Accent colour → #7fb2ff",
 * not "Updated". An unchanged state records nothing, so the panel stays a list
 * of real events.
 *
 * A history write must never fail the operation the visitor actually asked for.
 */

export type HistoryAction = 'created' | 'changed' | 'removed' | 'restored' | 'imported' | 'reset';

export type HistoryEntry = {
  id: string;
  at: string;
  action: HistoryAction;
  /** What it was about, in words: "Accent colour", "Lock on the Browse heading". */
  subject: string;
  /** Human summary of the change. */
  summary: string;
  /** The full snapshot needed to restore, redacted of anything secret. */
  snapshot?: unknown;
};

const KEY = 'oaklands.history.v1';
const MAX_ENTRIES = 500;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.id === 'string') : [];
  } catch { return []; }
}

/** Append. Never throws into the caller: a failed record must not fail the action. */
export function record(entry: Omit<HistoryEntry, 'id' | 'at'>): HistoryEntry | null {
  try {
    const history = loadHistory();
    const full: HistoryEntry = {
      ...entry,
      id: `h${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
    };
    // Retention: prune the oldest rather than refusing to record the newest.
    const next = [full, ...history].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return full;
  } catch {
    return null;
  }
}

export function clearHistory(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to undo */ }
}

/**
 * Describe what actually changed between two settings objects.
 *
 * Returns an empty list when nothing did, so an unchanged save records nothing.
 */
export function diffSettings(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const changes: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    changes.push(`${key}: ${format(a)} → ${format(b)}`);
  }
  return changes;
}

function format(value: unknown): string {
  if (value === undefined) return 'unset';
  if (typeof value === 'string') return value === '' ? 'empty' : value;
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/* --------------------------------------------------------------- exporting */

export type ExportFormat = 'json' | 'jsonl' | 'csv' | 'tsv' | 'markdown' | 'yaml' | 'html' | 'txt';

export const EXPORT_FORMATS: { id: ExportFormat; label: string; mime: string; extension: string }[] = [
  { id: 'json', label: 'JSON', mime: 'application/json', extension: 'json' },
  { id: 'jsonl', label: 'JSON Lines', mime: 'application/x-ndjson', extension: 'jsonl' },
  { id: 'csv', label: 'CSV', mime: 'text/csv', extension: 'csv' },
  { id: 'tsv', label: 'TSV', mime: 'text/tab-separated-values', extension: 'tsv' },
  { id: 'markdown', label: 'Markdown', mime: 'text/markdown', extension: 'md' },
  { id: 'yaml', label: 'YAML', mime: 'text/yaml', extension: 'yaml' },
  { id: 'html', label: 'HTML', mime: 'text/html', extension: 'html' },
  { id: 'txt', label: 'Plain text', mime: 'text/plain', extension: 'txt' },
];

const escapeCell = (value: unknown, delimiter: string): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return text.includes(delimiter) || text.includes('"') || text.includes('\n')
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

/**
 * Serialise rows into a chosen format.
 *
 * Every format here can faithfully carry a flat row set. Nothing is silently
 * dropped: a caller wanting to export something a format cannot represent is
 * told before the export runs rather than handed a truncated file.
 */
export function serialise(rows: Record<string, unknown>[], format: ExportFormat, title = 'Export'): string {
  if (rows.length === 0) return '';
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];

  switch (format) {
    case 'json': return `${JSON.stringify(rows, null, 2)}\n`;
    case 'jsonl': return `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
    case 'csv':
    case 'tsv': {
      const delimiter = format === 'csv' ? ',' : '\t';
      const head = columns.map((c) => escapeCell(c, delimiter)).join(delimiter);
      const body = rows.map((row) => columns.map((c) => escapeCell(row[c], delimiter)).join(delimiter));
      return `${[head, ...body].join('\n')}\n`;
    }
    case 'markdown': {
      const head = `| ${columns.join(' | ')} |`;
      const rule = `|${columns.map(() => '---').join('|')}|`;
      const body = rows.map((row) => `| ${columns.map((c) => String(row[c] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
      return `# ${title}\n\n${[head, rule, ...body].join('\n')}\n`;
    }
    case 'yaml':
      return `${rows.map((row) => `- ${columns.map((c) => `${c}: ${JSON.stringify(row[c] ?? null)}`).join('\n  ')}`).join('\n')}\n`;
    case 'html': {
      const escapeHtml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
      const body = rows.map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(row[c])}</td>`).join('')}</tr>`).join('\n');
      return `<!doctype html>\n<meta charset="utf-8">\n<title>${escapeHtml(title)}</title>\n<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>\n`;
    }
    case 'txt':
    default:
      return `${rows.map((row) => columns.map((c) => `${c}: ${row[c] ?? ''}`).join('\n')).join('\n\n')}\n`;
  }
}

/** Trigger a download in the browser. Nothing is uploaded anywhere. */
export function download(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
