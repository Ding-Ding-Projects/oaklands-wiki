/**
 * Browser-style tabs for this site.
 *
 * A tab is a page the visitor opened and kept. Order, pinned order, groups,
 * group order and collapsed state all persist, because a tab strip that forgets
 * itself on reload is a decoration rather than navigation.
 *
 * The strip docks to any edge and defaults to LEFT. A screen is wider than it is
 * tall and a tab label is wider than it is high, so a vertical strip shows more
 * tabs legibly than the horizontal one every browser trained everyone to expect.
 */

export type Dock = 'left' | 'right' | 'top' | 'bottom';

export type Tab = {
  id: string;
  title: string;
  url: string;
  pinned: boolean;
  groupId: string | null;
  /** Per-tab appearance, edited from the tab's own context menu. */
  appearance?: { colour?: string; bold?: boolean; italic?: boolean };
};

export type TabGroup = {
  id: string;
  name: string;
  colour: string;
  collapsed: boolean;
};

export type TabState = {
  dock: Dock;
  tabs: Tab[];
  groups: TabGroup[];
  activeId: string | null;
};

export const DEFAULT_TABS: TabState = { dock: 'left', tabs: [], groups: [], activeId: null };

const KEY = 'oaklands.tabs.v1';

const isDock = (value: unknown): value is Dock =>
  value === 'left' || value === 'right' || value === 'top' || value === 'bottom';

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value.slice(0, 300) : fallback;

/** Coerce anything into a valid tab state. Exported for the focused test. */
export function validateTabs(raw: unknown): TabState {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<TabState>;
  const groups: TabGroup[] = Array.isArray(input.groups)
    ? input.groups.slice(0, 40).map((g, index) => ({
        id: str((g as TabGroup)?.id, `group-${index}`),
        name: str((g as TabGroup)?.name, 'Group') || 'Group',
        colour: /^#[0-9a-fA-F]{6}$/.test(String((g as TabGroup)?.colour)) ? (g as TabGroup).colour : '#ffab5e',
        collapsed: (g as TabGroup)?.collapsed === true,
      }))
    : [];
  const groupIds = new Set(groups.map((g) => g.id));

  const tabs: Tab[] = Array.isArray(input.tabs)
    ? input.tabs.slice(0, 200).map((t, index) => {
        const tab = t as Tab;
        return {
          id: str(tab?.id, `tab-${index}`),
          title: str(tab?.title, 'Untitled') || 'Untitled',
          url: str(tab?.url, '/'),
          pinned: tab?.pinned === true,
          // A tab pointing at a group that no longer exists is ungrouped, not
          // orphaned into an invisible group.
          groupId: tab?.groupId && groupIds.has(tab.groupId) ? tab.groupId : null,
          appearance: tab?.appearance && typeof tab.appearance === 'object' ? tab.appearance : undefined,
        };
      })
    : [];

  const ids = new Set(tabs.map((t) => t.id));
  return {
    dock: isDock(input.dock) ? input.dock : 'left',
    tabs,
    groups,
    activeId: typeof input.activeId === 'string' && ids.has(input.activeId) ? input.activeId : null,
  };
}

export function loadTabs(): TabState {
  if (typeof window === 'undefined') return DEFAULT_TABS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? validateTabs(JSON.parse(raw)) : DEFAULT_TABS;
  } catch {
    return DEFAULT_TABS;
  }
}

export function saveTabs(state: TabState): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* not remembered */ }
}

/**
 * Pinned tabs occupy a stable region ahead of the rest and keep their relative
 * order. They are excluded from bulk closes by default, exactly as the contract
 * requires, so "close everything else" never silently takes them.
 */
export function orderTabs(state: TabState): Tab[] {
  const pinned = state.tabs.filter((t) => t.pinned);
  const rest = state.tabs.filter((t) => !t.pinned);
  return [...pinned, ...rest];
}

/**
 * Which tabs a bulk close would actually affect.
 *
 * Returned rather than performed, so the caller can show the exact count and a
 * reviewable preview before anything closes — and can report what was excluded
 * instead of silently skipping it.
 */
export function planBulkClose(
  tabs: Tab[],
  { text, invert, includePinned, matcher }: { text: string; invert: boolean; includePinned: boolean; matcher?: RegExp },
): { closing: Tab[]; keeping: Tab[]; excludedPinned: Tab[] } {
  if (text.trim() === '' && !matcher) return { closing: [], keeping: tabs, excludedPinned: [] };

  const hit = (tab: Tab) =>
    matcher ? matcher.test(tab.title) : tab.title.toLowerCase().includes(text.toLowerCase());

  const closing: Tab[] = [];
  const keeping: Tab[] = [];
  const excludedPinned: Tab[] = [];

  for (const tab of tabs) {
    // The inverse action negates the SAME predicate, so flags, casing and scope
    // cannot drift between "containing" and "not containing".
    const matches = invert ? !hit(tab) : hit(tab);
    if (!matches) { keeping.push(tab); continue; }
    if (tab.pinned && !includePinned) { excludedPinned.push(tab); keeping.push(tab); continue; }
    closing.push(tab);
  }
  return { closing, keeping, excludedPinned };
}
