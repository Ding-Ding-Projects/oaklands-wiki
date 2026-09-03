import { useCallback, useMemo, useState } from 'react';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';

/**
 * A local file converter.
 *
 * Everything runs in this browser: nothing is uploaded, and there is no
 * conversion service behind it. That constraint decides the catalogue, so the
 * catalogue states it rather than implying a capability the page does not have.
 *
 * **Every format is listed, including the ones that are unavailable**, each with
 * the exact reason. Hiding a gap makes the catalogue look complete and leaves
 * somebody hunting for a converter that was never there; showing a disabled row
 * with "needs a decoder this page does not bundle" answers the question in one
 * glance.
 */

type Category = 'Structured data' | 'Images' | 'Text' | 'Documents' | 'Archives';

type Adapter = {
  id: string;
  category: Category;
  from: string;
  to: string;
  label: string;
  /** Bundled and working in this browser, or the exact reason it is not. */
  available: true | string;
  lossy?: string;
  convert?: (input: { text?: string; file: File }) => Promise<{ blob: Blob; extension: string }>;
};

const textOf = (file: File) => file.text();

const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(cell); cell = ''; continue; }
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (char === '\r') continue;
    cell += char;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c !== ''));
  if (!head) return [];
  return body.map((line) => Object.fromEntries(head.map((key, index) => [key, line[index] ?? ''])));
};

const toCsv = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return '';
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => escape(r[c])).join(','))].join('\n');
};

/** Re-encode an image through a canvas. */
async function reencodeImage(file: File, mime: string, extension: string) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('this browser refused a 2D canvas context');
  context.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
  if (!blob) throw new Error(`this browser cannot encode ${mime}`);
  return { blob, extension };
}

const ADAPTERS: Adapter[] = [
  {
    id: 'json-csv', category: 'Structured data', from: 'JSON', to: 'CSV', label: 'JSON → CSV', available: true,
    lossy: 'Nested objects are flattened to their JSON text, because CSV has no nesting.',
    convert: async ({ file }) => {
      const parsed = JSON.parse(await textOf(file));
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return { blob: new Blob([toCsv(rows)], { type: 'text/csv' }), extension: 'csv' };
    },
  },
  {
    id: 'csv-json', category: 'Structured data', from: 'CSV', to: 'JSON', label: 'CSV → JSON', available: true,
    lossy: 'Every value becomes a string: CSV carries no types to preserve.',
    convert: async ({ file }) => ({
      blob: new Blob([JSON.stringify(parseCsv(await textOf(file)), null, 2)], { type: 'application/json' }),
      extension: 'json',
    }),
  },
  {
    id: 'csv-tsv', category: 'Structured data', from: 'CSV', to: 'TSV', label: 'CSV → TSV', available: true,
    convert: async ({ file }) => {
      const rows = parseCsv(await textOf(file));
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const body = [columns.join('\t'), ...rows.map((r) => columns.map((c) => String(r[c] ?? '').replace(/\t/g, ' ')).join('\t'))];
      return { blob: new Blob([body.join('\n')], { type: 'text/tab-separated-values' }), extension: 'tsv' };
    },
  },
  {
    id: 'json-markdown', category: 'Structured data', from: 'JSON', to: 'Markdown table', label: 'JSON → Markdown', available: true,
    convert: async ({ file }) => {
      const parsed = JSON.parse(await textOf(file));
      const rows: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const lines = [
        `| ${columns.join(' | ')} |`,
        `|${columns.map(() => '---').join('|')}|`,
        ...rows.map((r) => `| ${columns.map((c) => String(r[c] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
      ];
      return { blob: new Blob([lines.join('\n')], { type: 'text/markdown' }), extension: 'md' };
    },
  },
  {
    id: 'png-webp', category: 'Images', from: 'PNG or JPEG', to: 'WebP', label: 'Image → WebP', available: true,
    lossy: 'WebP here is lossy at quality 0.92, and any colour profile is flattened to sRGB.',
    convert: async ({ file }) => reencodeImage(file, 'image/webp', 'webp'),
  },
  {
    id: 'any-png', category: 'Images', from: 'Any decodable image', to: 'PNG', label: 'Image → PNG', available: true,
    lossy: 'Animation is not preserved: only the first frame is drawn.',
    convert: async ({ file }) => reencodeImage(file, 'image/png', 'png'),
  },
  {
    id: 'any-jpeg', category: 'Images', from: 'Any decodable image', to: 'JPEG', label: 'Image → JPEG', available: true,
    lossy: 'JPEG has no transparency: transparent pixels become black.',
    convert: async ({ file }) => reencodeImage(file, 'image/jpeg', 'jpg'),
  },
  {
    id: 'text-utf8', category: 'Text', from: 'Any text', to: 'UTF-8 with LF endings', label: 'Normalise text', available: true,
    convert: async ({ file }) => ({
      blob: new Blob([(await textOf(file)).replace(/\r\n?/g, '\n')], { type: 'text/plain;charset=utf-8' }),
      extension: 'txt',
    }),
  },
  {
    id: 'text-base64', category: 'Text', from: 'Any file', to: 'Base64', label: 'Anything → Base64', available: true,
    convert: async ({ file }) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return { blob: new Blob([btoa(binary)], { type: 'text/plain' }), extension: 'b64.txt' };
    },
  },

  // Listed and unavailable, each with the exact reason. A hidden gap makes the
  // catalogue look complete and sends somebody hunting for a converter that was
  // never here.
  { id: 'pdf-split', category: 'Documents', from: 'PDF', to: 'Split pages', label: 'PDF → split pages',
    available: 'Needs a bundled PDF library. This page ships no third-party bundle, so the tool is listed rather than pretended.' },
  { id: 'pdf-merge', category: 'Documents', from: 'Several PDFs', to: 'One PDF', label: 'PDF → merge',
    available: 'Needs a bundled PDF library, for the same reason as splitting.' },
  { id: 'pdf-text', category: 'Documents', from: 'PDF', to: 'Text', label: 'PDF → text',
    available: 'Needs a bundled PDF text extractor; the browser has no built-in one.' },
  { id: 'docx-md', category: 'Documents', from: 'DOCX', to: 'Markdown', label: 'DOCX → Markdown',
    available: 'DOCX is a ZIP of XML; unpacking it needs a bundled archive reader.' },
  { id: 'zip-extract', category: 'Archives', from: 'ZIP', to: 'Extracted files', label: 'ZIP → extract',
    available: 'Needs a bundled archive reader. The browser exposes DecompressionStream but not ZIP central-directory parsing.' },
  { id: 'svg-png', category: 'Images', from: 'SVG', to: 'PNG', label: 'SVG → PNG',
    available: 'An SVG can reference remote content, so rasterising one safely needs sanitising this page does not do yet.' },
  { id: 'heic-jpeg', category: 'Images', from: 'HEIC', to: 'JPEG', label: 'HEIC → JPEG',
    available: 'This browser cannot decode HEIC, so there is nothing to re-encode from.' },
];

const CATEGORIES: Category[] = ['Structured data', 'Images', 'Text', 'Documents', 'Archives'];

export function Converter({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('Structured data');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');

  const pool = useMemo(() => ADAPTERS.filter((a) => a.category === category), [category]);
  const search = useCallback((a: Adapter) => `${a.label} ${a.from} ${a.to}`, []);
  const { results, error } = useSearchFilter(pool, query, mode, flags, search);

  const run = async (adapter: Adapter) => {
    if (adapter.available !== true || !adapter.convert || !file) return;
    setBusy(adapter.id);
    setResult(null);
    try {
      const { blob, extension } = await adapter.convert({ file });
      const base = file.name.replace(/\.[^.]+$/, '');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${base}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setResult(`Converted to ${adapter.to} (${(blob.size / 1024).toFixed(1)} KB). The original is untouched.`);
    } catch (caught) {
      // The source file is never modified, and a failure names its reason.
      setResult(`Could not convert: ${caught instanceof Error ? caught.message : 'unknown error'}. Your file is unchanged.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ok-sheet ok-sheet--wide" role="dialog" aria-label="File converter">
      <div className="ok-sheet__head">
        <h2>Convert a file</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>

      <p className="ok-muted">
        Everything runs in this browser. Nothing is uploaded, there is no conversion service,
        and your original file is never modified.
      </p>

      <div className="ok-field">
        <label className="ok-field__label" htmlFor="conv-file">Choose a file</label>
        <input id="conv-file" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); }} />
        {file ? (
          <p className="ok-field__hint">
            <strong>{file.name}</strong> · {(file.size / 1024).toFixed(1)} KB · {file.type || 'type not declared'}
          </p>
        ) : (
          <p className="ok-field__hint">No file chosen yet. The conversions below stay listed either way.</p>
        )}
      </div>

      <div className="ok-tabs" role="tablist" aria-label="Conversion category">
        {CATEGORIES.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={category === name}
            className="ok-chip" onClick={() => setCategory(name)}>
            {name}
          </button>
        ))}
      </div>

      <SearchWithRegex
        label={`Search ${category}`}
        query={query} onQuery={setQuery} mode={mode} onMode={setMode}
        flags={flags} onFlags={setFlags} error={error}
        resultCount={results.length} totalCount={pool.length}
      />

      <ul className="ok-rows" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        {results.map((adapter) => (
          <li key={adapter.id}>
            <div className="ok-row" style={{ cursor: 'default', opacity: adapter.available === true ? 1 : 0.7 }}>
              <span className="ok-row__name">
                {adapter.label}
                {adapter.lossy ? <span className="ok-muted"> — {adapter.lossy}</span> : null}
                {adapter.available !== true ? (
                  <span className="ok-muted"> — <strong>unavailable:</strong> {adapter.available}</span>
                ) : null}
              </span>
              <button
                type="button"
                className="ok-chip"
                disabled={adapter.available !== true || !file || busy !== null}
                title={
                  adapter.available !== true ? adapter.available
                    : !file ? 'Choose a file first'
                    : undefined
                }
                onClick={() => void run(adapter)}
              >
                {busy === adapter.id ? 'Converting…' : 'Convert'}
              </button>
            </div>
          </li>
        ))}
        {results.length === 0 ? <li className="ok-muted">Nothing in {category} matches.</li> : null}
      </ul>

      {result ? <p className="ok-note" role="status" style={{ marginBlockStart: 'var(--ok-space-4)' }}>{result}</p> : null}
    </div>
  );
}

export { ADAPTERS };
