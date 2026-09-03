import { useCallback, useMemo, useState } from 'react';
import type { VisitorState, FunnyLevel, LanguageMode, AttentionMode } from '../lib/visitor-state';
import type { StringKey } from '../lib/i18n';
import { ColourPicker } from './ColourPicker';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';
import type { Notice } from './NotificationCentre';

type Translated = { primary: string; secondary: string | null };

/** Bilingual mode shows both without crowding: primary prominent, secondary compact. */
function Label({ value }: { value: Translated }) {
  return (
    <>
      {value.primary}
      {value.secondary ? <span className="ok-secondary-label"> {value.secondary}</span> : null}
    </>
  );
}

const TABS = ['Language', 'Appearance', 'Attention', 'Narrator', 'Privacy'] as const;
type Tab = (typeof TABS)[number];

/** Every setting, so the panel's own search can find one by name. */
type Row = { tab: Tab; id: string; label: string; hint?: string };

export function SettingsPanel({
  state, onChange, onReset, onClose, storageBlocked, notify, t,
}: {
  state: VisitorState;
  onChange: <K extends keyof VisitorState>(key: K, value: VisitorState[K]) => void;
  onReset: () => void;
  onClose: () => void;
  storageBlocked: boolean;
  notify: (notice: Omit<Notice, 'id' | 'at'>) => void;
  t: (key: StringKey) => Translated;
}) {
  const [tab, setTab] = useState<Tab>('Language');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');
  const [confirmReset, setConfirmReset] = useState(0);

  const rows: Row[] = useMemo(() => [
    { tab: 'Language', id: 'language', label: t('language.label').primary },
    { tab: 'Language', id: 'funny-en', label: t('funny.english').primary, hint: t('funny.hint').primary },
    { tab: 'Language', id: 'funny-yue', label: t('funny.cantonese').primary, hint: t('funny.hint').primary },
    { tab: 'Language', id: 'emoji', label: t('emoji.label').primary, hint: t('emoji.hint').primary },
    { tab: 'Language', id: 'school', label: state.schoolModeName },
    { tab: 'Appearance', id: 'theme', label: t('appearance.theme').primary },
    { tab: 'Appearance', id: 'density', label: t('appearance.density').primary },
    { tab: 'Appearance', id: 'accent', label: t('appearance.accent').primary },
    { tab: 'Appearance', id: 'fontScale', label: t('appearance.fontScale').primary },
    { tab: 'Appearance', id: 'reduceMotion', label: t('appearance.reduceMotion').primary },
    { tab: 'Attention', id: 'focus', label: 'Focus' },
    { tab: 'Attention', id: 'lowStimulation', label: 'Low stimulation' },
    { tab: 'Attention', id: 'timeAwareness', label: 'Time awareness' },
    { tab: 'Attention', id: 'oneThing', label: 'One thing at a time' },
    { tab: 'Attention', id: 'momentum', label: 'Momentum' },
    { tab: 'Narrator', id: 'narratorEnabled', label: 'Read pages aloud' },
    { tab: 'Narrator', id: 'narratorLanguage', label: 'Narrated language' },
    { tab: 'Narrator', id: 'narratorRate', label: 'Speaking rate' },
    { tab: 'Narrator', id: 'narratorPitch', label: 'Pitch' },
    { tab: 'Privacy', id: 'export', label: 'Export your settings' },
    { tab: 'Privacy', id: 'reset', label: t('settings.reset').primary },
  ], [t, state.schoolModeName]);

  const textOf = useCallback((row: Row) => `${row.label} ${row.hint ?? ''}`, []);
  const { results, error } = useSearchFilter(rows, query, mode, flags, textOf);
  const searching = query.trim() !== '';

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'oaklands-settings.json';
    anchor.click();
    URL.revokeObjectURL(url);
    notify({ kind: 'success', title: 'Settings exported', body: 'Downloaded as oaklands-settings.json.' });
  };

  const attentionModes: { key: AttentionMode; label: string; hint: string }[] = [
    { key: 'focus', label: 'Focus', hint: 'Brings the current section forward and pushes the rest back. Nothing is hidden that one action cannot bring back.' },
    { key: 'lowStimulation', label: 'Low stimulation', hint: 'Fewer moving things and quieter colour. Composes with your system reduced-motion setting rather than overriding it.' },
    { key: 'timeAwareness', label: 'Time awareness', hint: 'Shows how long this page has been open. It states a number; it does not nag.' },
    { key: 'oneThing', label: 'One thing at a time', hint: 'Keeps one visible next action that you choose, and that survives a page change.' },
    { key: 'momentum', label: 'Momentum', hint: 'A dismissible prompt after a long idle stretch. "Not now" is respected for a stated period.' },
  ];

  return (
    <div className="ok-sheet ok-sheet--wide" role="dialog" aria-label="Settings" aria-modal="false">
      <div className="ok-sheet__head">
        <h2><Label value={t('settings.title')} /></h2>
        <button type="button" className="ok-chip" onClick={onClose}>Close</button>
      </div>

      {storageBlocked ? (
        <p className="ok-note" role="status"><Label value={t('settings.storageBlocked')} /></p>
      ) : null}

      <SearchWithRegex
        label="Search settings"
        query={query} onQuery={setQuery}
        mode={mode} onMode={setMode}
        flags={flags} onFlags={setFlags}
        error={error}
        resultCount={results.length}
        totalCount={rows.length}
      />

      {searching ? (
        <ul className="ok-rows" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
          {results.map((row) => (
            <li key={row.id}>
              <button type="button" className="ok-row" style={{ width: '100%', textAlign: 'start' }} onClick={() => { setTab(row.tab); setQuery(''); }}>
                <span className="ok-row__name">{row.label}</span>
                <span className="ok-row__meta">{row.tab}</span>
              </button>
            </li>
          ))}
          {results.length === 0 ? <li className="ok-muted"><Label value={t('nothing.matches')} /></li> : null}
        </ul>
      ) : (
        <>
          <div className="ok-tabs" role="tablist" aria-label="Settings sections">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className="ok-chip"
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="ok-settings" role="tabpanel">
            {tab === 'Language' ? (
              <>
                <Field label={<Label value={t('language.label')} />}>
                  <select value={state.language} onChange={(e) => onChange('language', e.target.value as LanguageMode)}>
                    <option value="en">English</option>
                    <option value="yue">廣東話</option>
                    <option value="both">Bilingual · 雙語</option>
                  </select>
                </Field>

                <Field label={<Label value={t('funny.english')} />} hint={<Label value={t('funny.hint')} />}>
                  <FunnySlider value={state.funnyEnglish} onChange={(v) => onChange('funnyEnglish', v)} name="funny-en" />
                </Field>
                <Field label={<Label value={t('funny.cantonese')} />}>
                  <FunnySlider value={state.funnyCantonese} onChange={(v) => onChange('funnyCantonese', v)} name="funny-yue" />
                </Field>

                <Field label={<Label value={t('emoji.label')} />} hint={<Label value={t('emoji.hint')} />}>
                  <Switch checked={state.dialogEmoji} onChange={(v) => onChange('dialogEmoji', v)} label="Show emoji in dialogs" />
                </Field>

                <Field
                  label={state.schoolModeName}
                  hint="Forces English and makes the Cantonese, funny-level and dim-sum capabilities behave as though they are not installed. Your choices are kept and return when it is switched off. This is a user-experience lock, not a security boundary: clearing this site's storage turns it off."
                >
                  <Switch checked={state.schoolMode} onChange={(v) => onChange('schoolMode', v)} label={state.schoolModeName} />
                  <input
                    type="text"
                    aria-label={t('school.name').primary}
                    value={state.schoolModeName}
                    maxLength={48}
                    onChange={(e) => onChange('schoolModeName', e.target.value)}
                    style={{ marginBlockStart: 'var(--ok-space-2)' }}
                  />
                </Field>
              </>
            ) : null}

            {tab === 'Appearance' ? (
              <>
                <Field label={<Label value={t('appearance.theme')} />}>
                  <select value={state.theme} onChange={(e) => onChange('theme', e.target.value as VisitorState['theme'])}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </Field>
                <Field label={<Label value={t('appearance.density')} />}>
                  <select value={state.density} onChange={(e) => onChange('density', e.target.value as VisitorState['density'])}>
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </Field>
                <Field label={<Label value={t('appearance.fontScale')} />}>
                  <input
                    type="range" min={0.85} max={1.5} step={0.05}
                    value={state.fontScale}
                    onChange={(e) => onChange('fontScale', Number(e.target.value))}
                  />
                  <output>{Math.round(state.fontScale * 100)}%</output>
                </Field>
                <Field label={<Label value={t('appearance.reduceMotion')} />}>
                  <Switch checked={state.reduceMotion} onChange={(v) => onChange('reduceMotion', v)} label="Reduce motion" />
                </Field>
                <Field label={<Label value={t('appearance.accent')} />}>
                  <ColourPicker value={state.accent} onChange={(hex) => onChange('accent', hex)} />
                </Field>
              </>
            ) : null}

            {tab === 'Attention' ? (
              <>
                <p className="ok-muted"><Label value={t('attention.hint')} /></p>
                {attentionModes.map((mode) => (
                  <Field key={mode.key} label={mode.label} hint={mode.hint}>
                    <Switch
                      checked={state.attention[mode.key]}
                      onChange={(v) => onChange('attention', { ...state.attention, [mode.key]: v })}
                      label={mode.label}
                    />
                  </Field>
                ))}
              </>
            ) : null}

            {tab === 'Narrator' ? (
              <NarratorSettings state={state} onChange={onChange} />
            ) : null}

            {tab === 'Privacy' ? (
              <>
                <p className="ok-muted">
                  Everything here is stored in this browser only. There is no account, no sync and
                  no analytics, so nothing to delete anywhere else.
                </p>
                <Field label="Export your settings" hint="Downloads a JSON file of exactly what is stored. Nothing is uploaded.">
                  <button type="button" onClick={exportSettings}>Export as JSON</button>
                </Field>
                <Field
                  label={<Label value={t('settings.reset')} />}
                  hint="Irreversible: it clears this site's stored settings. Confirm twice, because there is no undo."
                >
                  {confirmReset === 0 ? (
                    <button type="button" onClick={() => setConfirmReset(1)}>Reset everything…</button>
                  ) : confirmReset === 1 ? (
                    <>
                      <p><strong>This clears every setting on this site.</strong> It cannot be undone.</p>
                      <button type="button" onClick={() => setConfirmReset(2)}>I understand — continue</button>{' '}
                      <button type="button" onClick={() => setConfirmReset(0)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <p>Confirm once more to reset.</p>
                      <button type="button" onClick={() => { onReset(); setConfirmReset(0); }}>Reset now</button>{' '}
                      <button type="button" onClick={() => setConfirmReset(0)}>Cancel</button>
                    </>
                  )}
                </Field>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ok-field">
      <div className="ok-field__label">{label}</div>
      {children}
      {hint ? <p className="ok-field__hint">{hint}</p> : null}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="ok-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span>{checked ? 'On' : 'Off'}</span>
    </label>
  );
}

function FunnySlider({ value, onChange, name }: { value: FunnyLevel; onChange: (v: FunnyLevel) => void; name: string }) {
  const NAMES = ['Fully serious', 'Serious', 'Balanced', 'Playful', 'Maximum playfulness'];
  return (
    <div className="ok-funny">
      <input
        type="range" min={1} max={5} step={1} value={value}
        aria-label={`Funny level, 1 serious to 5 playful`}
        name={name}
        onChange={(e) => onChange(Number(e.target.value) as FunnyLevel)}
      />
      <output>{value} — {NAMES[value - 1]}</output>
    </div>
  );
}

function NarratorSettings({
  state, onChange,
}: {
  state: VisitorState;
  onChange: <K extends keyof VisitorState>(key: K, value: VisitorState[K]) => void;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [enumerated, setEnumerated] = useState(false);

  // Voice enumeration commonly returns nothing on the first call and fills in a
  // moment later behind an event. A picker that reads it once reports "no voices
  // installed" on a machine with forty, and looks broken rather than slow.
  useMemo(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { setEnumerated(true); return; }
    const read = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length > 0) { setVoices(list); setEnumerated(true); }
    };
    read();
    window.speechSynthesis.addEventListener('voiceschanged', read);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', read);
  }, []);

  const supported = typeof window !== 'undefined' && !!window.speechSynthesis;
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const cantonese = voices.filter((v) => /yue|zh-hk|zh_hk/i.test(v.lang));

  return (
    <>
      <p className="ok-muted">
        Off by default. It reads page events aloud, one utterance at a time, and yields to a
        screen reader rather than talking over it.
      </p>
      {!supported ? (
        <p className="ok-note">This browser exposes no speech synthesis, so the narrator cannot run here.</p>
      ) : null}

      <Field label="Read pages aloud">
        <Switch checked={state.narratorEnabled} onChange={(v) => onChange('narratorEnabled', v)} label="Narrator" />
      </Field>

      <Field label="Narrated language" hint="Both speaks English first, then Cantonese, strictly one after the other.">
        <select value={state.narratorLanguage} onChange={(e) => onChange('narratorLanguage', e.target.value as LanguageMode)}>
          <option value="en">English</option>
          <option value="yue">Cantonese</option>
          <option value="both">Both</option>
        </select>
      </Field>

      {/* One picker per language: choosing an English voice says nothing about
          which Cantonese voice should read the other half of a bilingual line. */}
      <Field
        label="English voice"
        hint={english.length === 0 && enumerated ? 'No English voice is installed on this computer.' : undefined}
      >
        <select value={state.narratorVoiceEn} onChange={(e) => onChange('narratorVoiceEn', e.target.value)}>
          <option value="">Choose automatically</option>
          {english.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
        </select>
        {state.narratorVoiceEn && !english.some((v) => v.voiceURI === state.narratorVoiceEn) ? (
          <p className="ok-field__hint">
            <strong>That voice is not installed on this computer.</strong> Your choice is kept; the
            narrator falls back to an available one.
          </p>
        ) : null}
      </Field>

      <Field
        label="Cantonese voice"
        hint={cantonese.length === 0 && enumerated ? 'No Cantonese voice is installed on this computer.' : undefined}
      >
        <select value={state.narratorVoiceYue} onChange={(e) => onChange('narratorVoiceYue', e.target.value)}>
          <option value="">Choose automatically</option>
          {cantonese.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
        </select>
      </Field>

      <Field label="Speaking rate">
        <input type="range" min={0.5} max={2} step={0.1} value={state.narratorRate}
          onChange={(e) => onChange('narratorRate', Number(e.target.value))} aria-label="Speaking rate" />
        <output>{state.narratorRate.toFixed(1)}x</output>
      </Field>
      <Field label="Pitch">
        <input type="range" min={0.5} max={2} step={0.1} value={state.narratorPitch}
          onChange={(e) => onChange('narratorPitch', Number(e.target.value))} aria-label="Pitch" />
        <output>{state.narratorPitch.toFixed(1)}</output>
      </Field>
    </>
  );
}
