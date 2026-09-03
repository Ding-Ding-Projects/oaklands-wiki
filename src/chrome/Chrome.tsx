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
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyState(state, document.documentElement);
    if (!saveState(state)) setStorageBlocked(true);
  }, [state, ready]);

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
    setState((current) => ({ ...current, [key]: value }));
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
      <AttentionBar state={state} />

      <div className="ok-chrome-bar">
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
