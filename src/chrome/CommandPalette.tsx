import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VisitorState, LanguageMode, FunnyLevel } from '../lib/visitor-state';
import { href } from '../lib/routes';

/**
 * Command palette, on Ctrl+Shift+F.
 *
 * Rows are rich where a value has a control: a setting result renders its live
 * switch, slider or select inline, wired to the same state the settings panel
 * writes. Somebody who can see a value has usually come to change it, and
 * sending them somewhere else to do that is a round trip the interface could
 * have saved.
 *
 * Selecting a destination navigates to the exact surface rather than a general
 * page, so a result is never a hint about where to look next.
 */

type Command =
  | { kind: 'action'; id: string; label: string; group: string; run: () => void }
  | { kind: 'link'; id: string; label: string; group: string; to: string }
  | { kind: 'setting'; id: string; label: string; group: string; control: React.ReactNode };

export function CommandPalette({
  state, onChange, onClose, onOpenSettings,
}: {
  state: VisitorState;
  onChange: <K extends keyof VisitorState>(key: K, value: VisitorState[K]) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [full, setFull] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commands: Command[] = useMemo(() => [
    { kind: 'link', id: 'go-home', group: 'Go to', label: 'Home', to: '/' },
    { kind: 'link', id: 'go-browse', group: 'Go to', label: 'Browse all articles', to: '/browse/' },
    { kind: 'link', id: 'go-about', group: 'Go to', label: 'About this archive', to: '/about/' },
    { kind: 'action', id: 'open-settings', group: 'Actions', label: 'Open settings', run: onOpenSettings },
    {
      kind: 'action', id: 'toggle-theme', group: 'Actions',
      label: `Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme`,
      run: () => onChange('theme', state.theme === 'dark' ? 'light' : 'dark'),
    },
    {
      kind: 'setting', id: 'set-language', group: 'Settings', label: 'Language',
      control: (
        <select
          value={state.language}
          aria-label="Language"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange('language', e.target.value as LanguageMode)}
        >
          <option value="en">English</option>
          <option value="yue">廣東話</option>
          <option value="both">Bilingual</option>
        </select>
      ),
    },
    {
      kind: 'setting', id: 'set-funny-en', group: 'Settings', label: 'English funny level',
      control: (
        <input
          type="range" min={1} max={5} step={1} value={state.funnyEnglish}
          aria-label="English funny level"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange('funnyEnglish', Number(e.target.value) as FunnyLevel)}
        />
      ),
    },
    {
      kind: 'setting', id: 'set-funny-yue', group: 'Settings', label: 'Cantonese funny level',
      control: (
        <input
          type="range" min={1} max={5} step={1} value={state.funnyCantonese}
          aria-label="Cantonese funny level"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange('funnyCantonese', Number(e.target.value) as FunnyLevel)}
        />
      ),
    },
    {
      kind: 'setting', id: 'set-density', group: 'Settings', label: 'Density',
      control: (
        <select value={state.density} aria-label="Density" onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange('density', e.target.value as VisitorState['density'])}>
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      ),
    },
    {
      kind: 'setting', id: 'set-emoji', group: 'Settings', label: 'Emoji in dialogs',
      control: (
        <input
          type="checkbox" checked={state.dialogEmoji} aria-label="Emoji in dialogs"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange('dialogEmoji', e.target.checked)}
        />
      ),
    },
    {
      kind: 'setting', id: 'set-reduce-motion', group: 'Settings', label: 'Reduce motion',
      control: (
        <input
          type="checkbox" checked={state.reduceMotion} aria-label="Reduce motion"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange('reduceMotion', e.target.checked)}
        />
      ),
    },
  ], [state, onChange, onOpenSettings]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((c) => `${c.group} ${c.label}`.toLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => { setActive(0); }, [query]);

  const activate = useCallback((command: Command) => {
    if (command.kind === 'link') { window.location.href = href(command.to); return; }
    if (command.kind === 'action') { command.run(); onClose(); }
    // A setting row is operated in place; activating it does not close.
  }, [onClose]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (event.key === 'Enter' && results[active]) { event.preventDefault(); activate(results[active]); }
  };

  return (
    <div className="ok-palette-backdrop" onClick={onClose}>
      <div
        className={`ok-palette${full ? ' ok-palette--full' : ''}`}
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ok-palette__head">
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Search commands, settings and destinations…"
            aria-label="Search commands"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button type="button" className="ok-chip" onClick={() => setFull((f) => !f)}>
            {full ? 'Card' : 'Full window'}
          </button>
          <button type="button" className="ok-chip" onClick={onClose}>Esc</button>
        </div>

        <ul className="ok-palette__list" ref={listRef} role="listbox" aria-label="Results">
          {results.map((command, index) => (
            <li
              key={command.id}
              role="option"
              aria-selected={index === active}
              className={`ok-palette__row${index === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => activate(command)}
            >
              <span className="ok-palette__group">{command.group}</span>
              <span className="ok-palette__label">{command.label}</span>
              {command.kind === 'setting' ? (
                <span className="ok-palette__control">{command.control}</span>
              ) : null}
            </li>
          ))}
          {results.length === 0 ? (
            <li className="ok-palette__row ok-muted">No command matches &ldquo;{query}&rdquo;.</li>
          ) : null}
        </ul>

        <p className="ok-palette__foot">
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> opens this anywhere · <kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to run
        </p>
      </div>
    </div>
  );
}
