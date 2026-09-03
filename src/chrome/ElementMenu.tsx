import { useEffect, useState } from 'react';
import { targetOf, isUnlocked, relock, loadLocks, saveLocks, type Lock } from '../lib/locks';
import { LockWizard, UnlockPrompt } from './LockSurfaces';
import type { VisitorState } from '../lib/visitor-state';

/**
 * A right-click menu for every rendered element, plus its keyboard equivalent.
 *
 * The menu is target-specific: it names the element under the pointer and offers
 * the actions that apply to it, including **Lock this element…** and **Edit
 * appearance…**. Every menu carries its own filter field, however short it is —
 * a four-item menu grows to fourteen without anyone revisiting the decision, and
 * a visitor who learns to type in one menu and finds the next one inert has
 * learned the pattern is unreliable.
 *
 * A locked element is genuinely inert: its activation is intercepted here, at
 * the document level, so a keyboard press or a programmatic click cannot walk
 * around a disabled attribute.
 */

function describe(element: Element): string {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const name = element.getAttribute('aria-label') ?? text;
  const kind = element.tagName.toLowerCase();
  return name ? `${name.slice(0, 48)}${name.length > 48 ? '…' : ''}` : `<${kind}>`;
}

export function ElementMenu({
  state, onClearAll,
}: {
  state: VisitorState;
  onClearAll: () => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; element: Element } | null>(null);
  const [query, setQuery] = useState('');
  const [locks, setLocks] = useState<Record<string, Lock>>({});
  const [wizardFor, setWizardFor] = useState<{ target: string; label: string } | null>(null);
  const [unlockFor, setUnlockFor] = useState<Lock | null>(null);
  const [appearanceFor, setAppearanceFor] = useState<{ target: string; label: string } | null>(null);

  useEffect(() => { setLocks(loadLocks()); }, []);

  // Open on right-click anywhere, and on Shift+F10 / the context-menu key.
  useEffect(() => {
    const onContext = (event: MouseEvent) => {
      const element = event.target as Element | null;
      if (!element || element.closest('.ok-sheet, .ok-elementmenu, .ok-palette')) return;
      event.preventDefault();
      setQuery('');
      setMenu({ x: event.clientX, y: event.clientY, element });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        const element = document.activeElement;
        if (!element || element === document.body) return;
        event.preventDefault();
        const box = element.getBoundingClientRect();
        setQuery('');
        setMenu({ x: box.left, y: box.bottom, element });
      }
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // A locked element refuses its action and opens its own prompt instead. This
  // runs in the capture phase so a handler on the element never sees the event.
  useEffect(() => {
    const intercept = (event: Event) => {
      const element = event.target as Element | null;
      if (!element || element.closest('.ok-sheet')) return;
      for (const [target, lock] of Object.entries(locks)) {
        const owner = document.querySelector(cssFor(target));
        if (!owner || !(owner === element || owner.contains(element))) continue;
        if (isUnlocked(target)) return;
        event.preventDefault();
        event.stopPropagation();
        setUnlockFor(lock);
        return;
      }
    };
    document.addEventListener('click', intercept, true);
    document.addEventListener('keydown', intercept, true);
    return () => {
      document.removeEventListener('click', intercept, true);
      document.removeEventListener('keydown', intercept, true);
    };
  }, [locks]);

  const items = menu ? buildItems(menu.element) : [];
  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  function buildItems(element: Element) {
    const target = targetOf(element);
    const label = describe(element);
    const existing = locks[target];
    return [
      existing
        ? { label: 'Remove this lock', run: () => { const next = { ...locks }; delete next[target]; setLocks(next); saveLocks(next); relock(target); setMenu(null); } }
        : { label: 'Lock this element…', run: () => { setWizardFor({ target, label }); setMenu(null); } },
      ...(existing && isUnlocked(target)
        ? [{ label: 'Lock again now', run: () => { relock(target); setMenu(null); } }]
        : []),
      { label: 'Edit appearance…', run: () => { setAppearanceFor({ target, label }); setMenu(null); } },
      { label: 'Copy this text', run: () => { void navigator.clipboard?.writeText(element.textContent ?? ''); setMenu(null); } },
      { label: 'Support Tickets…', run: () => { onClearAll(); setMenu(null); } },
    ];
  }

  return (
    <>
      {menu ? (
        <div
          className="ok-elementmenu"
          role="menu"
          style={{ insetInlineStart: Math.min(menu.x, window.innerWidth - 260), insetBlockStart: Math.min(menu.y, window.innerHeight - 260) }}
          onMouseLeave={() => setMenu(null)}
        >
          <p className="ok-elementmenu__target">{describe(menu.element)}</p>
          <input
            type="text"
            className="ok-tabmenu__filter"
            placeholder="Filter…"
            aria-label="Filter menu items"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {filtered.map((item) => (
            <button key={item.label} type="button" role="menuitem" className="ok-tabmenu__item" onClick={item.run}>
              {item.label}
            </button>
          ))}
          {filtered.length === 0 ? <p className="ok-tabmenu__empty">No item matches.</p> : null}
        </div>
      ) : null}

      {wizardFor ? (
        <LockWizard
          target={wizardFor.target}
          label={wizardFor.label}
          onCreate={(lock) => {
            const next = { ...locks, [lock.target]: lock };
            setLocks(next);
            saveLocks(next);
            setWizardFor(null);
          }}
          onClose={() => setWizardFor(null)}
        />
      ) : null}

      {unlockFor ? (
        <UnlockPrompt
          lock={unlockFor}
          state={state}
          onUnlocked={() => setUnlockFor(null)}
          onClose={() => setUnlockFor(null)}
        />
      ) : null}

      {appearanceFor ? (
        <ElementAppearance
          label={appearanceFor.label}
          target={appearanceFor.target}
          onClose={() => setAppearanceFor(null)}
        />
      ) : null}
    </>
  );
}

/** Turn a structural target back into a selector the document can resolve. */
function cssFor(target: string): string {
  if (target.startsWith('#')) return target;
  return target
    .split('>')
    .map((part) => {
      const [tag, index] = part.split(':');
      return `${tag}:nth-child(${Number(index) + 1})`;
    })
    .join('>');
}

/* --------------------------------------------------- per-element appearance */

const STYLE_ID = 'ok-element-appearance';
const KEY = 'oaklands.elementAppearance.v1';

type Appearance = {
  colour?: string; background?: string; fontSize?: string; weight?: string;
  italic?: boolean; underline?: boolean; letterSpacing?: string; radius?: string;
};

function readAppearance(): Record<string, Appearance> {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}

/**
 * Apply every saved per-element rule.
 *
 * One stylesheet rebuilt from the store, rather than inline styles written onto
 * nodes: prerendered pages replace their DOM on every navigation, and an inline
 * style would vanish with it while the stored value quietly remained.
 */
export function applyElementAppearance(): void {
  const store = readAppearance();
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = Object.entries(store)
    .map(([target, appearance]) => {
      const declarations = [
        appearance.colour && `color:${appearance.colour}`,
        appearance.background && `background:${appearance.background}`,
        appearance.fontSize && `font-size:${appearance.fontSize}`,
        appearance.weight && `font-weight:${appearance.weight}`,
        appearance.italic && 'font-style:italic',
        appearance.underline && 'text-decoration:underline',
        appearance.letterSpacing && `letter-spacing:${appearance.letterSpacing}`,
        appearance.radius && `border-radius:${appearance.radius}`,
      ].filter(Boolean).join(';');
      return declarations ? `${cssFor(target)}{${declarations}}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function ElementAppearance({ target, label, onClose }: { target: string; label: string; onClose: () => void }) {
  const [appearance, setAppearance] = useState<Appearance>(() => readAppearance()[target] ?? {});

  const commit = (next: Appearance) => {
    setAppearance(next);
    const store = readAppearance();
    if (Object.keys(next).length === 0) delete store[target];
    else store[target] = next;
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* not remembered */ }
    applyElementAppearance();
  };

  return (
    <div className="ok-sheet" role="dialog" aria-label={`Appearance of ${label}`}>
      <div className="ok-sheet__head">
        <h2>Edit appearance</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>
      <p className="ok-muted">Applies to <strong>{label}</strong> only, and persists in this browser.</p>

      <div className="ok-settings">
        <div className="ok-field">
          <label className="ok-field__label" htmlFor="ea-colour">Text colour</label>
          <input id="ea-colour" type="color" value={appearance.colour ?? '#ffab5e'}
            onChange={(event) => commit({ ...appearance, colour: event.target.value })} />
        </div>
        <div className="ok-field">
          <label className="ok-field__label" htmlFor="ea-bg">Background</label>
          <input id="ea-bg" type="color" value={appearance.background ?? '#14171d'}
            onChange={(event) => commit({ ...appearance, background: event.target.value })} />
        </div>
        <div className="ok-field">
          <label className="ok-field__label" htmlFor="ea-size">Font size</label>
          <select id="ea-size" value={appearance.fontSize ?? ''} onChange={(event) => commit({ ...appearance, fontSize: event.target.value || undefined })}>
            <option value="">Unchanged</option>
            {['0.75rem', '0.875rem', '1rem', '1.125rem', '1.25rem', '1.5rem', '2rem'].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="ok-field">
          <label className="ok-field__label" htmlFor="ea-weight">Weight</label>
          <select id="ea-weight" value={appearance.weight ?? ''} onChange={(event) => commit({ ...appearance, weight: event.target.value || undefined })}>
            <option value="">Unchanged</option>
            {['300', '400', '500', '600', '700', '800'].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
          </select>
        </div>
        <div className="ok-field">
          <span className="ok-field__label">Style</span>
          <label className="ok-switch">
            <input type="checkbox" checked={appearance.italic ?? false}
              onChange={(event) => commit({ ...appearance, italic: event.target.checked || undefined })} />
            <span>Italic</span>
          </label>
          <label className="ok-switch">
            <input type="checkbox" checked={appearance.underline ?? false}
              onChange={(event) => commit({ ...appearance, underline: event.target.checked || undefined })} />
            <span>Underline</span>
          </label>
        </div>
        <div className="ok-field">
          <label className="ok-field__label" htmlFor="ea-tracking">Letter spacing</label>
          <select id="ea-tracking" value={appearance.letterSpacing ?? ''} onChange={(event) => commit({ ...appearance, letterSpacing: event.target.value || undefined })}>
            <option value="">Unchanged</option>
            {['-0.02em', '0', '0.02em', '0.06em', '0.12em'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => commit({})}>Reset this element</button>
      </div>
    </div>
  );
}
