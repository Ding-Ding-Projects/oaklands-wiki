import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_TABS, loadTabs, saveTabs, orderTabs, planBulkClose,
  type Dock, type Tab, type TabState,
} from '../lib/tabs';
import { SearchWithRegex, useSearchFilter, compilePattern, type SearchMode } from '../components/SearchWithRegex';

/**
 * The tab strip.
 *
 * Docks to any edge, left by default. Everything the contract asks for is here
 * because a partial tab strip is worse than none: an overflow surface rather
 * than silent clipping, reordering, pinning into a stable region, groups that
 * collapse, four separate searches, per-tab appearance, and the two bulk closes
 * with a reviewable preview.
 *
 * Orientation is not decoration. A vertical strip is `aria-orientation="vertical"`
 * and its arrow keys are up/down — get that wrong and the strip looks right and
 * is unusable by keyboard, which no screenshot will ever reveal.
 */

type Menu = { tabId: string; x: number; y: number } | null;
type SearchScope = 'strip' | 'group' | 'groups' | 'all';

export function TabStrip() {
  const [state, setState] = useState<TabState>(DEFAULT_TABS);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [scope, setScope] = useState<SearchScope | null>(null);
  const [appearanceFor, setAppearanceFor] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ text: string; invert: boolean; includePinned: boolean; regex: boolean } | null>(null);
  const [groupPickerFor, setGroupPickerFor] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setState(loadTabs());
    setReady(true);
  }, []);

  useEffect(() => { if (ready) saveTabs(state); }, [state, ready]);

  // Adopt the current page as a tab so the strip is never empty on arrival.
  useEffect(() => {
    if (!ready) return;
    const url = window.location.pathname;
    const title = document.title.replace(/ — Oaklands Wiki$/, '');
    setState((current) => {
      const existing = current.tabs.find((t) => t.url === url);
      if (existing) return { ...current, activeId: existing.id };
      const tab: Tab = { id: `t${Date.now()}`, title, url, pinned: false, groupId: null };
      return { ...current, tabs: [...current.tabs, tab], activeId: tab.id };
    });
  }, [ready]);

  const vertical = state.dock === 'left' || state.dock === 'right';
  const ordered = useMemo(() => orderTabs(state), [state]);

  const update = useCallback((patch: Partial<TabState> | ((s: TabState) => TabState)) => {
    setState((current) => (typeof patch === 'function' ? patch(current) : { ...current, ...patch }));
  }, []);

  const closeTab = (id: string) =>
    update((s) => ({ ...s, tabs: s.tabs.filter((t) => t.id !== id), activeId: s.activeId === id ? null : s.activeId }));

  const move = (id: string, delta: number) =>
    update((s) => {
      const index = s.tabs.findIndex((t) => t.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= s.tabs.length) return s;
      const tabs = [...s.tabs];
      [tabs[index], tabs[target]] = [tabs[target], tabs[index]];
      return { ...s, tabs };
    });

  // Arrow keys follow the AXIS, not the markup.
  const onStripKeyDown = (event: React.KeyboardEvent) => {
    const forward = vertical ? 'ArrowDown' : 'ArrowRight';
    const back = vertical ? 'ArrowUp' : 'ArrowLeft';
    if (event.key !== forward && event.key !== back) return;
    event.preventDefault();
    const items = [...(stripRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === forward ? index + 1 : index - 1;
    items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
  };

  /**
   * Tell the page a side strip is there, so the content can move out from under
   * it.
   *
   * The strip is `position: fixed`, which takes it out of flow entirely, so
   * nothing below it knows it exists. That left it sitting on top of the first
   * 240px of every page at desktop widths — permanently, for every visitor, with
   * no overflow and no error to show for it. A fixed overlay is invisible to a
   * layout check; only measuring the two boxes against each other finds it.
   */
  useEffect(() => {
    const visible = ready && state.tabs.length > 0;
    if (visible && (state.dock === 'left' || state.dock === 'right')) {
      document.body.dataset.tabstrip = state.dock;
    } else {
      delete document.body.dataset.tabstrip;
    }
    return () => { delete document.body.dataset.tabstrip; };
  }, [ready, state.tabs.length, state.dock]);

  if (!ready || state.tabs.length === 0) return null;

  const menuTab = menu ? state.tabs.find((t) => t.id === menu.tabId) ?? null : null;
  const appearanceTab = appearanceFor ? state.tabs.find((t) => t.id === appearanceFor) ?? null : null;

  return (
    <>
      <div
        ref={stripRef}
        className="ok-tabstrip"
        data-dock={state.dock}
        role="tablist"
        aria-label="Open pages"
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        onKeyDown={onStripKeyDown}
      >
        <div className="ok-tabstrip__head">
          <button type="button" className="ok-chip" onClick={() => setScope('strip')} aria-label="Search this tab strip">⌕</button>
          <button type="button" className="ok-chip" onClick={() => setOverflowOpen(true)} aria-label="All tabs and groups">⋯</button>
        </div>

        <div className="ok-tabstrip__list">
          {state.groups.map((group) => {
            const members = ordered.filter((t) => t.groupId === group.id);
            if (members.length === 0) return null;
            return (
              <div key={group.id} className="ok-tabgroup" style={{ ['--ok-group-colour' as string]: group.colour }}>
                <button
                  type="button"
                  className="ok-tabgroup__head"
                  aria-expanded={!group.collapsed}
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      groups: s.groups.map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)),
                    }))
                  }
                >
                  <span className="ok-tabgroup__dot" aria-hidden="true" />
                  {group.name}
                  <span className="ok-muted">({members.length})</span>
                </button>
                {!group.collapsed
                  ? members.map((tab) => <TabButton key={tab.id} tab={tab} state={state} setMenu={setMenu} />)
                  : null}
              </div>
            );
          })}
          {ordered.filter((t) => !t.groupId).map((tab) => (
            <TabButton key={tab.id} tab={tab} state={state} setMenu={setMenu} />
          ))}
        </div>
      </div>

      {/* Context menu: every item that has a keyboard shortcut shows it. */}
      {menu && menuTab ? (
        <div
          className="ok-tabmenu"
          style={{ insetInlineStart: menu.x, insetBlockStart: menu.y }}
          role="menu"
          onMouseLeave={() => setMenu(null)}
        >
          <MenuSearch>
            {[
              { label: menuTab.pinned ? 'Unpin' : 'Pin', run: () => update((s) => ({ ...s, tabs: s.tabs.map((t) => t.id === menuTab.id ? { ...t, pinned: !t.pinned } : t) })) },
              { label: 'Move earlier', run: () => move(menuTab.id, -1) },
              { label: 'Move later', run: () => move(menuTab.id, 1) },
              { label: 'Move… into group…', run: () => { setGroupPickerFor(menuTab.id); setMenu(null); } },
              { label: 'Edit tab appearance…', run: () => { setAppearanceFor(menuTab.id); setMenu(null); }, shortcut: 'Shift+Right-click' },
              { label: 'Close tabs containing text…', run: () => { setBulk({ text: '', invert: false, includePinned: false, regex: false }); setMenu(null); } },
              { label: 'Close tabs NOT containing text…', run: () => { setBulk({ text: '', invert: true, includePinned: false, regex: false }); setMenu(null); } },
              { label: 'Close this tab', run: () => { closeTab(menuTab.id); setMenu(null); }, shortcut: 'Ctrl+W' },
            ]}
          </MenuSearch>
        </div>
      ) : null}

      {groupPickerFor ? (
        <GroupPicker
          state={state}
          onPick={(groupId) => {
            update((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === groupPickerFor ? { ...t, groupId } : t)) }));
            setGroupPickerFor(null);
          }}
          onCreate={(name, colour) => {
            const id = `g${Date.now()}`;
            update((s) => ({
              ...s,
              groups: [...s.groups, { id, name, colour, collapsed: false }],
              tabs: s.tabs.map((t) => (t.id === groupPickerFor ? { ...t, groupId: id } : t)),
            }));
            setGroupPickerFor(null);
          }}
          onClose={() => setGroupPickerFor(null)}
        />
      ) : null}

      {appearanceTab ? (
        <TabAppearance
          tab={appearanceTab}
          onChange={(appearance) =>
            update((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === appearanceTab.id ? { ...t, appearance } : t)) }))
          }
          onClose={() => setAppearanceFor(null)}
        />
      ) : null}

      {bulk ? (
        <BulkClose
          tabs={state.tabs}
          options={bulk}
          onOptions={setBulk}
          onConfirm={(ids) => {
            update((s) => ({ ...s, tabs: s.tabs.filter((t) => !ids.includes(t.id)) }));
            setBulk(null);
          }}
          onClose={() => setBulk(null)}
        />
      ) : null}

      {(overflowOpen || scope) ? (
        <TabSearches
          state={state}
          initialScope={scope ?? 'all'}
          onDock={(dock) => update({ dock })}
          onClose={() => { setOverflowOpen(false); setScope(null); }}
        />
      ) : null}
    </>
  );
}

function TabButton({ tab, state, setMenu }: { tab: Tab; state: TabState; setMenu: (m: Menu) => void }) {
  const group = state.groups.find((g) => g.id === tab.groupId);
  return (
    <a
      role="tab"
      aria-selected={state.activeId === tab.id}
      className="ok-tab"
      data-pinned={tab.pinned || undefined}
      href={tab.url}
      title={tab.title}
      style={{
        color: tab.appearance?.colour,
        fontWeight: tab.appearance?.bold ? 700 : undefined,
        fontStyle: tab.appearance?.italic ? 'italic' : undefined,
        ['--ok-group-colour' as string]: group?.colour,
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ tabId: tab.id, x: event.clientX, y: event.clientY });
      }}
    >
      {tab.pinned ? <span aria-label="Pinned">📌</span> : null}
      <span className="ok-tab__label">{tab.title}</span>
    </a>
  );
}

/** Every menu carries its own filter, however short it is. */
function MenuSearch({ children }: { children: { label: string; run: () => void; shortcut?: string }[] }) {
  const [query, setQuery] = useState('');
  const items = children.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <input
        type="text"
        className="ok-tabmenu__filter"
        placeholder="Filter…"
        aria-label="Filter menu items"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {items.map((item) => (
        <button key={item.label} type="button" role="menuitem" className="ok-tabmenu__item" onClick={item.run}>
          <span>{item.label}</span>
          {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
        </button>
      ))}
      {items.length === 0 ? <p className="ok-tabmenu__empty">No item matches.</p> : null}
    </>
  );
}

function GroupPicker({
  state, onPick, onCreate, onClose,
}: {
  state: TabState;
  onPick: (groupId: string | null) => void;
  onCreate: (name: string, colour: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');
  const [name, setName] = useState('');
  const textOf = useCallback((g: { name: string }) => g.name, []);
  const { results, error } = useSearchFilter(state.groups, query, mode, flags, textOf);

  return (
    <div className="ok-sheet" role="dialog" aria-label="Move into group">
      <div className="ok-sheet__head">
        <h2>Move into group…</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>
      <SearchWithRegex
        label="Search groups" query={query} onQuery={setQuery}
        mode={mode} onMode={setMode} flags={flags} onFlags={setFlags}
        error={error} resultCount={results.length} totalCount={state.groups.length}
      />
      {state.groups.length === 0 ? (
        <p className="ok-muted">No groups yet. Create the first one below.</p>
      ) : (
        <ul className="ok-rows" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
          {results.map((group) => (
            <li key={group.id}>
              <button type="button" className="ok-row" style={{ width: '100%' }} onClick={() => onPick(group.id)}>
                <span className="ok-tabgroup__dot" style={{ ['--ok-group-colour' as string]: group.colour }} aria-hidden="true" />
                <span className="ok-row__name">{group.name}</span>
                <span className="ok-row__meta">{state.tabs.filter((t) => t.groupId === group.id).length}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="ok-field" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        <label className="ok-field__label" htmlFor="new-group">New group</label>
        <div style={{ display: 'flex', gap: 'var(--ok-space-2)' }}>
          <input id="new-group" type="text" value={name} placeholder="Group name" onChange={(e) => setName(e.target.value)} />
          <button type="button" disabled={name.trim() === ''} onClick={() => onCreate(name.trim(), '#ffab5e')}>Create</button>
        </div>
      </div>
      <button type="button" className="ok-chip" style={{ marginBlockStart: 'var(--ok-space-3)' }} onClick={() => onPick(null)}>
        Remove from its group
      </button>
    </div>
  );
}

function TabAppearance({ tab, onChange, onClose }: { tab: Tab; onChange: (a: Tab['appearance']) => void; onClose: () => void }) {
  const appearance = tab.appearance ?? {};
  return (
    <div className="ok-sheet" role="dialog" aria-label={`Appearance of ${tab.title}`}>
      <div className="ok-sheet__head">
        <h2>Edit tab appearance</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>
      <p className="ok-muted">Applies to <strong>{tab.title}</strong> only, and persists with the tab.</p>
      <div className="ok-settings">
        <div className="ok-field">
          <label className="ok-field__label" htmlFor="tab-colour">Text colour</label>
          <input id="tab-colour" type="color" value={appearance.colour ?? '#ffab5e'}
            onChange={(e) => onChange({ ...appearance, colour: e.target.value })} />
        </div>
        <div className="ok-field">
          <span className="ok-field__label">Weight and style</span>
          <label className="ok-switch">
            <input type="checkbox" checked={appearance.bold ?? false} onChange={(e) => onChange({ ...appearance, bold: e.target.checked })} />
            <span>Bold</span>
          </label>
          <label className="ok-switch">
            <input type="checkbox" checked={appearance.italic ?? false} onChange={(e) => onChange({ ...appearance, italic: e.target.checked })} />
            <span>Italic</span>
          </label>
        </div>
        <button type="button" onClick={() => onChange(undefined)}>Reset this tab</button>
      </div>
    </div>
  );
}

function BulkClose({
  tabs, options, onOptions, onConfirm, onClose,
}: {
  tabs: Tab[];
  options: { text: string; invert: boolean; includePinned: boolean; regex: boolean };
  onOptions: (o: typeof options) => void;
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { regex: pattern, error } = options.regex
    ? { regex: compilePattern(options.text, 'i').regex, error: compilePattern(options.text, 'i').error }
    : { regex: null, error: null };

  const plan = useMemo(
    () => planBulkClose(tabs, { ...options, matcher: pattern ?? undefined }),
    [tabs, options, pattern],
  );

  const blocked = options.text.trim() === '' || !!error;

  return (
    <div className="ok-sheet" role="dialog" aria-label="Close tabs by text">
      <div className="ok-sheet__head">
        <h2>Close tabs {options.invert ? 'NOT containing' : 'containing'} text</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>

      <div className="ok-field">
        <label className="ok-field__label" htmlFor="bulk-text">Match against the tab label</label>
        <input id="bulk-text" type="text" autoFocus value={options.text}
          onChange={(e) => onOptions({ ...options, text: e.target.value })} />
        <label className="ok-switch">
          <input type="checkbox" checked={options.regex} onChange={(e) => onOptions({ ...options, regex: e.target.checked })} />
          <span>Treat as a regular expression</span>
        </label>
        <label className="ok-switch">
          <input type="checkbox" checked={options.includePinned} onChange={(e) => onOptions({ ...options, includePinned: e.target.checked })} />
          <span>Include pinned tabs</span>
        </label>
        {error ? <p className="ok-field__hint"><strong>Invalid pattern:</strong> {error}</p> : null}
      </div>

      {/* Say what will happen before it happens, and name what is excluded. */}
      <div className="ok-note">
        <p style={{ margin: 0 }}>
          {blocked
            ? 'Enter text first. A bulk close never runs on an empty query or an invalid pattern.'
            : <><strong>{plan.closing.length}</strong> tab{plan.closing.length === 1 ? '' : 's'} will close; {plan.keeping.length} will stay.</>}
        </p>
        {plan.excludedPinned.length > 0 ? (
          <p style={{ marginBlockStart: 'var(--ok-space-2)' }}>
            <strong>{plan.excludedPinned.length} pinned tab{plan.excludedPinned.length === 1 ? '' : 's'} excluded:</strong>{' '}
            {plan.excludedPinned.map((t) => t.title).join(', ')}
          </p>
        ) : null}
      </div>

      {plan.closing.length > 0 ? (
        <ul className="ok-rows" style={{ marginBlockStart: 'var(--ok-space-3)' }}>
          {plan.closing.slice(0, 12).map((tab) => (
            <li key={tab.id}><div className="ok-row" style={{ cursor: 'default' }}><span className="ok-row__name">{tab.title}</span></div></li>
          ))}
          {plan.closing.length > 12 ? <li className="ok-muted">…and {plan.closing.length - 12} more</li> : null}
        </ul>
      ) : null}

      <button
        type="button"
        style={{ marginBlockStart: 'var(--ok-space-4)' }}
        disabled={blocked || plan.closing.length === 0}
        onClick={() => onConfirm(plan.closing.map((t) => t.id))}
      >
        Close {plan.closing.length} tab{plan.closing.length === 1 ? '' : 's'}
      </button>
    </div>
  );
}

/** The four tab searches, each with its own field and its own regex builder. */
function TabSearches({
  state, initialScope, onDock, onClose,
}: {
  state: TabState;
  initialScope: SearchScope;
  onDock: (dock: Dock) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<SearchScope>(initialScope);
  const [groupId, setGroupId] = useState<string | null>(state.groups[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');

  const pool = useMemo(() => {
    if (scope === 'group') return state.tabs.filter((t) => t.groupId === groupId);
    if (scope === 'groups') return [];
    return state.tabs;
  }, [scope, state.tabs, groupId]);

  const textOf = useCallback((t: Tab) => t.title, []);
  const { results, error } = useSearchFilter(pool, query, mode, flags, textOf);

  const groupTextOf = useCallback((g: { name: string }) => g.name, []);
  const groupSearch = useSearchFilter(state.groups, query, mode, flags, groupTextOf);

  const SCOPES: { id: SearchScope; label: string }[] = [
    { id: 'strip', label: 'This strip' },
    { id: 'group', label: 'Inside one group' },
    { id: 'groups', label: 'Groups by name' },
    { id: 'all', label: 'Every open tab' },
  ];

  return (
    <div className="ok-sheet ok-sheet--wide" role="dialog" aria-label="Tabs">
      <div className="ok-sheet__head">
        <h2>Tabs</h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>

      <div className="ok-field">
        <span className="ok-field__label">Dock the strip</span>
        <div style={{ display: 'flex', gap: 'var(--ok-space-2)', flexWrap: 'wrap' }}>
          {(['left', 'right', 'top', 'bottom'] as Dock[]).map((dock) => (
            <button key={dock} type="button" className="ok-chip" aria-pressed={state.dock === dock} onClick={() => onDock(dock)}>
              {dock}
            </button>
          ))}
        </div>
      </div>

      <div className="ok-tabs" role="tablist" aria-label="Search scope">
        {SCOPES.map((entry) => (
          <button key={entry.id} type="button" role="tab" aria-selected={scope === entry.id}
            className="ok-chip" onClick={() => setScope(entry.id)}>
            {entry.label}
          </button>
        ))}
      </div>

      {scope === 'group' && state.groups.length > 0 ? (
        <select value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value)} aria-label="Group">
          {state.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      ) : null}

      <SearchWithRegex
        label={SCOPES.find((s) => s.id === scope)?.label ?? 'Search'}
        query={query} onQuery={setQuery}
        mode={mode} onMode={setMode} flags={flags} onFlags={setFlags}
        error={scope === 'groups' ? groupSearch.error : error}
        resultCount={scope === 'groups' ? groupSearch.results.length : results.length}
        totalCount={scope === 'groups' ? state.groups.length : pool.length}
      />

      <ul className="ok-rows" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        {scope === 'groups'
          ? groupSearch.results.map((group) => (
              <li key={group.id}>
                <div className="ok-row" style={{ cursor: 'default' }}>
                  <span className="ok-tabgroup__dot" style={{ ['--ok-group-colour' as string]: group.colour }} aria-hidden="true" />
                  <span className="ok-row__name">{group.name}</span>
                  <span className="ok-row__meta">
                    {state.tabs.filter((t) => t.groupId === group.id).length} tabs{group.collapsed ? ' · collapsed' : ''}
                  </span>
                </div>
              </li>
            ))
          : results.map((tab) => {
              const group = state.groups.find((g) => g.id === tab.groupId);
              return (
                <li key={tab.id}>
                  <a className="ok-row" href={tab.url}>
                    <span className="ok-row__name">{tab.title}</span>
                    <span className="ok-row__meta">
                      {tab.pinned ? 'pinned · ' : ''}{group ? group.name : 'ungrouped'}
                    </span>
                  </a>
                </li>
              );
            })}
        {(scope === 'groups' ? groupSearch.results.length : results.length) === 0 ? (
          <li className="ok-muted">Nothing matches.</li>
        ) : null}
      </ul>
    </div>
  );
}
