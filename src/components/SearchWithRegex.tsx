import { useId, useMemo, useRef, useState } from 'react';

/**
 * A search field with its own regex builder, anchored to this field.
 *
 * Plain text is the default and regex is an explicit opt-in. The builder opens
 * as a popover attached to the field it belongs to, never a page elsewhere, and
 * each instance owns its own query, pattern, flags, mode and validation — two
 * search fields on one surface never share state.
 */

export type SearchMode = 'text' | 'regex';

/** A construct the builder can insert, with what it actually does. */
const TOKENS: { group: string; items: { insert: string; label: string; hint: string }[] }[] = [
  {
    group: 'Anchors',
    items: [
      { insert: '^', label: '^', hint: 'start of the text' },
      { insert: '$', label: '$', hint: 'end of the text' },
      { insert: '\\b', label: '\\b', hint: 'word boundary' },
    ],
  },
  {
    group: 'Classes',
    items: [
      { insert: '.', label: '.', hint: 'any character' },
      { insert: '\\d', label: '\\d', hint: 'a digit' },
      { insert: '\\w', label: '\\w', hint: 'a word character' },
      { insert: '\\s', label: '\\s', hint: 'whitespace' },
      { insert: '[a-z]', label: '[a-z]', hint: 'any one of a set' },
      { insert: '[^a-z]', label: '[^a-z]', hint: 'anything not in a set' },
    ],
  },
  {
    group: 'Quantifiers',
    items: [
      { insert: '*', label: '*', hint: 'zero or more' },
      { insert: '+', label: '+', hint: 'one or more' },
      { insert: '?', label: '?', hint: 'optional' },
      { insert: '{2,4}', label: '{2,4}', hint: 'between two and four' },
      { insert: '*?', label: '*?', hint: 'zero or more, lazily' },
    ],
  },
  {
    group: 'Groups',
    items: [
      { insert: '(…)', label: '(…)', hint: 'capture a group' },
      { insert: '(?:…)', label: '(?:…)', hint: 'group without capturing' },
      { insert: '(?<name>…)', label: '(?<name>…)', hint: 'named capture' },
      { insert: 'a|b', label: 'a|b', hint: 'either one or the other' },
    ],
  },
  {
    group: 'Lookaround',
    items: [
      { insert: '(?=…)', label: '(?=…)', hint: 'followed by' },
      { insert: '(?!…)', label: '(?!…)', hint: 'not followed by' },
      { insert: '(?<=…)', label: '(?<=…)', hint: 'preceded by' },
      { insert: '(?<!…)', label: '(?<!…)', hint: 'not preceded by' },
    ],
  },
];

const FLAGS: { flag: string; label: string; hint: string }[] = [
  { flag: 'i', label: 'i', hint: 'ignore case' },
  { flag: 'm', label: 'm', hint: 'multiline anchors' },
  { flag: 's', label: 's', hint: 'dot matches newlines' },
  { flag: 'u', label: 'u', hint: 'unicode' },
];

/**
 * Compile a pattern, reporting the engine's own message on failure.
 *
 * The engine here is JavaScript's own RegExp, and the builder says so: a builder
 * that describes constructs its engine does not support is worse than none.
 */
export function compilePattern(pattern: string, flags: string): { regex: RegExp | null; error: string | null } {
  if (pattern === '') return { regex: null, error: null };
  // A pattern long enough to be pathological is refused rather than run.
  if (pattern.length > 1000) return { regex: null, error: 'Pattern is too long (limit 1000 characters).' };
  try {
    return { regex: new RegExp(pattern, flags), error: null };
  } catch (error) {
    return { regex: null, error: error instanceof Error ? error.message : 'Invalid pattern.' };
  }
}

export function useSearchFilter<T>(items: T[], query: string, mode: SearchMode, flags: string, textOf: (item: T) => string) {
  return useMemo(() => {
    if (query.trim() === '') return { results: items, error: null as string | null };
    if (mode === 'text') {
      const needle = query.toLowerCase();
      return { results: items.filter((item) => textOf(item).toLowerCase().includes(needle)), error: null };
    }
    const { regex, error } = compilePattern(query, flags);
    if (error) return { results: items, error };
    if (!regex) return { results: items, error: null };
    return { results: items.filter((item) => regex.test(textOf(item))), error: null };
  }, [items, query, mode, flags, textOf]);
}

export function SearchWithRegex({
  label,
  query,
  onQuery,
  mode,
  onMode,
  flags,
  onFlags,
  error,
  resultCount,
  totalCount,
}: {
  label: string;
  query: string;
  onQuery: (value: string) => void;
  mode: SearchMode;
  onMode: (value: SearchMode) => void;
  flags: string;
  onFlags: (value: string) => void;
  error: string | null;
  resultCount: number;
  totalCount: number;
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const inputId = useId();
  const builderId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const insert = (text: string) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? query.length;
    const end = input.selectionEnd ?? query.length;
    const next = `${query.slice(0, start)}${text}${query.slice(end)}`;
    onQuery(next);
    // Regex is now clearly intended; switching silently would be worse.
    if (mode !== 'regex') onMode('regex');
    requestAnimationFrame(() => {
      input.focus();
      const caret = start + text.length;
      input.setSelectionRange(caret, caret);
    });
  };

  const toggleFlag = (flag: string) =>
    onFlags(flags.includes(flag) ? flags.replace(flag, '') : `${flags}${flag}`);

  return (
    <div className="ok-search">
      <div className="ok-search__row">
        <label className="ok-search__label" htmlFor={inputId}>{label}</label>
        <div className="ok-search__field">
          <input
            id={inputId}
            ref={inputRef}
            type="search"
            value={query}
            spellCheck={false}
            autoComplete="off"
            placeholder={mode === 'regex' ? 'Regular expression…' : 'Type to filter…'}
            aria-describedby={`${inputId}-status`}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onQuery(event.target.value)}
          />
          <button
            type="button"
            className="ok-search__builder-toggle"
            aria-expanded={builderOpen}
            aria-controls={builderId}
            onClick={() => setBuilderOpen((open) => !open)}
          >
            .* Regex
          </button>
        </div>
      </div>

      <p id={`${inputId}-status`} className="ok-search__status" role="status">
        {error
          ? `Invalid pattern: ${error}`
          : query.trim() === ''
            ? `${totalCount} items`
            : `${resultCount} of ${totalCount} match`}
      </p>

      {builderOpen ? (
        // Anchored to this field, not a separate page. It stays inside the
        // viewport and scrolls internally rather than clipping its own content.
        <div className="ok-search__builder" id={builderId}>
          <div className="ok-search__modes" role="group" aria-label="Match mode">
            <label>
              <input type="radio" name={`${inputId}-mode`} checked={mode === 'text'} onChange={() => onMode('text')} />
              Plain text
            </label>
            <label>
              <input type="radio" name={`${inputId}-mode`} checked={mode === 'regex'} onChange={() => onMode('regex')} />
              Regular expression
            </label>
          </div>

          <div className="ok-search__flags" role="group" aria-label="Flags">
            {FLAGS.map((entry) => (
              <label key={entry.flag} title={entry.hint}>
                <input
                  type="checkbox"
                  checked={flags.includes(entry.flag)}
                  disabled={mode !== 'regex'}
                  onChange={() => toggleFlag(entry.flag)}
                />
                <code>{entry.label}</code> {entry.hint}
              </label>
            ))}
          </div>

          {TOKENS.map((group) => (
            <div key={group.group} className="ok-search__tokens">
              <p className="ok-eyebrow">{group.group}</p>
              <div>
                {group.items.map((token) => (
                  <button key={token.insert} type="button" title={token.hint} onClick={() => insert(token.insert)}>
                    <code>{token.label}</code>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <p className="ok-search__engine">
            Patterns run in this browser with JavaScript&rsquo;s own regular-expression
            engine. Nothing is sent anywhere, and constructs that engine does not support
            are reported as errors rather than silently ignored.
          </p>
        </div>
      ) : null}
    </div>
  );
}
