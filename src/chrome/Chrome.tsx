import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_STATE, applyState, clearState, loadState, saveState,
  type VisitorState, type FunnyLevel, type LanguageMode,
} from '../lib/visitor-state';
import { translate, type StringKey } from '../lib/i18n';
import { SettingsPanel } from './SettingsPanel';
import { CommandPalette } from './CommandPalette';
import { NotificationCentre, type Notice } from './NotificationCentre';
import { AttentionBar } from './AttentionBar';
import { TabStrip } from './TabStrip';
import { ElementMenu, applyElementAppearance } from './ElementMenu';
import { SupportTickets } from './LockSurfaces';
import { HistoryPanel } from './HistoryPanel';
import { Authenticator } from './Authenticator';
import { ScheduledSettings } from './ScheduledSettings';
import { Converter } from './Converter';
import { record, diffSettings } from '../lib/history';
import { Narrator } from '../lib/narrator';

/**
 * The chrome that every page carries, whatever else is on it.
 *
 * Article pages prerender their body as static HTML and never hydrate it, so
 * this mounts into its own empty container instead. That keeps a thousand
 * article pages free of a bundle that would re-render markup already correct,
 * while still giving every one of them working settings, palette, notifications
 * and theme — rather than controls that exist on some pages and not others.
 */
export function Chrome() {
  const [state, setState] = useState<VisitorState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  // Six floating chips are 498px wide and do not fit a 320px viewport, so below
  // the breakpoint they collapse behind one control rather than overflowing.
  const [toolsOpen, setToolsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [converterOpen, setConverterOpen] = useState(false);
  const [scheduled, setScheduled] = useState<Partial<VisitorState> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const narrator = useMemo(() => new Narrator(() => stateRef.current), []);

  const notify = useCallback((notice: Omit<Notice, 'id' | 'at'>) => {
    setNotices((current) => [
      { ...notice, id: `${Date.now()}-${current.length}`, at: new Date() },
      ...current,
    ].slice(0, 50));
  }, []);

  // Load after mount. Reading storage during render would make the server and
  // client disagree and React would discard the prerendered markup.
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setReady(true);
    applyElementAppearance();
  }, []);

  useEffect(() => {
    if (!ready) return;
    // The schedule overlays the base state rather than replacing it, so what is
    // saved is always the visitor's own choice and turning every rule off gives
    // back exactly what was there before.
    applyState({ ...state, ...(scheduled ?? {}) }, document.documentElement);
    if (!saveState(state)) setStorageBlocked(true);
  }, [state, scheduled, ready]);

  // Ctrl+Shift+F opens the palette. Not Ctrl+K: the contract names this key.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === 'Escape') { setPaletteOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const t = useCallback(
    (key: StringKey) => translate(key, state),
    [state],
  );

  const update = useCallback(<K extends keyof VisitorState>(key: K, value: VisitorState[K]) => {
    setState((current) => {
      const next = { ...current, [key]: value };
      // Record what CHANGED, not that something did. An unchanged save records
      // nothing, so the panel stays a list of real events.
      const changes = diffSettings(
        current as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
      );
      if (changes.length > 0) {
        record({ action: 'changed', subject: String(key), summary: changes.join('; '), snapshot: current });
      }
      return next;
    });
    narrator.say('setting', `${String(key)} changed`, `${String(key)} 改咗`);
  }, [narrator]);

  useEffect(() => {
    if (!state.narratorEnabled) narrator.cancel();
  }, [state.narratorEnabled, narrator]);

  const resetAll = useCallback(() => {
    clearState();
    setState(DEFAULT_STATE);
    notify({ kind: 'info', title: 'Settings reset', body: 'Everything is back to the shipped defaults.' });
  }, [notify]);

  const label = useMemo(() => t('settings.title'), [t]);

  return (
    <>
      <TabStrip />
      <ElementMenu state={state} onClearAll={() => setTicketsOpen(true)} />
      <AttentionBar state={state} />

      <div className="ok-chrome-bar" data-open={toolsOpen || undefined}>
        <button
          type="button"
          className="ok-chip ok-chrome-bar__toggle"
          aria-expanded={toolsOpen}
          aria-label={toolsOpen ? 'Hide tools' : 'Show tools'}
          onClick={() => setToolsOpen((open) => !open)}
        >
          {toolsOpen ? '✕' : '⚙'}
        </button>
        <button
          type="button"
          className="ok-chip"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(true)}
        >
          ⚙ {label.primary}
        </button>
        <button
          type="button"
          className="ok-chip"
          aria-haspopup="dialog"
          aria-expanded={paletteOpen}
          onClick={() => setPaletteOpen(true)}
          title="Ctrl+Shift+F"
        >
          ⌘ Commands
        </button>
        <button type="button" className="ok-chip" aria-haspopup="dialog" onClick={() => setHistoryOpen(true)}>
          ⏱ History
        </button>
        <button type="button" className="ok-chip" aria-haspopup="dialog" onClick={() => setAuthOpen(true)}>
          🔑 Codes
        </button>
        <button type="button" className="ok-chip" aria-haspopup="dialog" onClick={() => setScheduleOpen(true)}>
          🕒 Schedule
        </button>
        <button type="button" className="ok-chip" aria-haspopup="dialog" onClick={() => setConverterOpen(true)}>
          ⇄ Convert
        </button>
        <NotificationCentre notices={notices} onDismiss={(id) => setNotices((n) => n.filter((x) => x.id !== id))} />
      </div>

      {settingsOpen ? (
        <SettingsPanel
          state={state}
          onChange={update}
          onReset={resetAll}
          onClose={() => setSettingsOpen(false)}
          storageBlocked={storageBlocked}
          notify={notify}
          t={t}
        />
      ) : null}

      {historyOpen ? (
        <HistoryPanel
          onRestore={(entry) => {
            if (entry.snapshot && typeof entry.snapshot === 'object') {
              setState(entry.snapshot as VisitorState);
              notify({ kind: 'success', title: 'Restored', body: `Settings from ${new Date(entry.at).toLocaleString()}.` });
            }
          }}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}

      {authOpen ? <Authenticator onClose={() => setAuthOpen(false)} /> : null}

      {scheduleOpen ? (
        <ScheduledSettings onApply={setScheduled} onClose={() => setScheduleOpen(false)} />
      ) : null}

      {converterOpen ? <Converter onClose={() => setConverterOpen(false)} /> : null}

      {ticketsOpen ? (
        <SupportTickets
          onClose={() => setTicketsOpen(false)}
          onClearAll={() => {
            // The visitor's own act, in their own browser. Nothing is deleted
            // anywhere else, because nothing exists anywhere else.
            try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* nothing to undo */ }
            window.location.reload();
          }}
        />
      ) : null}

      {paletteOpen ? (
        <CommandPalette
          state={state}
          onChange={update}
          onClose={() => setPaletteOpen(false)}
          onOpenSettings={() => { setPaletteOpen(false); setSettingsOpen(true); }}
        />
      ) : null}
    </>
  );
}

export type { FunnyLevel, LanguageMode };
