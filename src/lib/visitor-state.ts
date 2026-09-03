/**
 * Per-visitor settings, persisted in this browser only.
 *
 * Nothing here is sent anywhere. There is no account, no sync and no telemetry,
 * so "reset" means clearing this site's storage — which every surface that can
 * lock a visitor out says out loud rather than implying a support channel.
 *
 * Validation is deliberate: a hand-edited or corrupted value must fall back to
 * the shipped default rather than reaching a renderer, because a NaN in a CSS
 * duration silently disables an animation instead of failing.
 */

export type LanguageMode = 'en' | 'yue' | 'both';
export type FunnyLevel = 1 | 2 | 3 | 4 | 5;
export type Theme = 'dark' | 'light';
export type Density = 'comfortable' | 'compact';
export type AttentionMode = 'focus' | 'lowStimulation' | 'timeAwareness' | 'oneThing' | 'momentum';

export type VisitorState = {
  language: LanguageMode;
  funnyEnglish: FunnyLevel;
  funnyCantonese: FunnyLevel;
  dialogEmoji: boolean;
  theme: Theme;
  density: Density;
  accent: string;
  fontScale: number;
  reduceMotion: boolean;
  attention: Record<AttentionMode, boolean>;
  /** Renamed School mode: the label the visitor chose, and whether it is on. */
  schoolMode: boolean;
  schoolModeName: string;
  narratorEnabled: boolean;
  narratorLanguage: LanguageMode;
  narratorVoiceEn: string;
  narratorVoiceYue: string;
  narratorRate: number;
  narratorPitch: number;
};

export const DEFAULT_STATE: VisitorState = {
  language: 'en',
  // Both sliders ship at 5, as the contract requires.
  funnyEnglish: 5,
  funnyCantonese: 5,
  dialogEmoji: true,
  theme: 'dark',
  density: 'comfortable',
  accent: '#ffab5e',
  fontScale: 1,
  reduceMotion: false,
  attention: {
    focus: false, lowStimulation: false, timeAwareness: false, oneThing: false, momentum: false,
  },
  schoolMode: false,
  schoolModeName: 'School mode',
  narratorEnabled: false,
  narratorLanguage: 'en',
  narratorVoiceEn: '',
  narratorVoiceYue: '',
  narratorRate: 1,
  narratorPitch: 1,
};

const STORAGE_KEY = 'oaklands.settings.v1';

const isFunny = (value: unknown): value is FunnyLevel =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;

const isHexColour = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

const clampNumber = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/**
 * Coerce anything into a valid state.
 *
 * Exported so the focused test can drive it with no browser at all — the
 * validation is the part worth testing, not the storage call around it.
 */
export function validate(raw: unknown): VisitorState {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<VisitorState>;
  const attention = (input.attention && typeof input.attention === 'object' ? input.attention : {}) as Partial<VisitorState['attention']>;
  return {
    language: input.language === 'yue' || input.language === 'both' ? input.language : 'en',
    funnyEnglish: isFunny(input.funnyEnglish) ? input.funnyEnglish : DEFAULT_STATE.funnyEnglish,
    funnyCantonese: isFunny(input.funnyCantonese) ? input.funnyCantonese : DEFAULT_STATE.funnyCantonese,
    dialogEmoji: typeof input.dialogEmoji === 'boolean' ? input.dialogEmoji : DEFAULT_STATE.dialogEmoji,
    theme: input.theme === 'light' ? 'light' : 'dark',
    density: input.density === 'compact' ? 'compact' : 'comfortable',
    accent: isHexColour(input.accent) ? input.accent : DEFAULT_STATE.accent,
    fontScale: clampNumber(input.fontScale, 0.85, 1.5, 1),
    reduceMotion: typeof input.reduceMotion === 'boolean' ? input.reduceMotion : false,
    attention: {
      focus: attention.focus === true,
      lowStimulation: attention.lowStimulation === true,
      timeAwareness: attention.timeAwareness === true,
      oneThing: attention.oneThing === true,
      momentum: attention.momentum === true,
    },
    schoolMode: input.schoolMode === true,
    schoolModeName:
      typeof input.schoolModeName === 'string' && input.schoolModeName.trim().length > 0
        ? input.schoolModeName.trim().slice(0, 48)
        : DEFAULT_STATE.schoolModeName,
    narratorEnabled: input.narratorEnabled === true,
    narratorLanguage: input.narratorLanguage === 'yue' || input.narratorLanguage === 'both' ? input.narratorLanguage : 'en',
    narratorVoiceEn: typeof input.narratorVoiceEn === 'string' ? input.narratorVoiceEn.slice(0, 200) : '',
    narratorVoiceYue: typeof input.narratorVoiceYue === 'string' ? input.narratorVoiceYue.slice(0, 200) : '',
    narratorRate: clampNumber(input.narratorRate, 0.5, 2, 1),
    narratorPitch: clampNumber(input.narratorPitch, 0.5, 2, 1),
  };
}

export function loadState(): VisitorState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return validate(JSON.parse(raw));
  } catch {
    // Corrupt storage falls back to the defaults rather than throwing on load.
    return DEFAULT_STATE;
  }
}

export function saveState(state: VisitorState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Storage may be disabled or full. The setting still applies for this visit;
    // it simply will not be remembered, which the settings surface reports.
    return false;
  }
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* nothing to undo */ }
}

/**
 * Apply the parts of the state the stylesheet consumes.
 *
 * School mode forces English presentation and behaves as though every dim-sum
 * and language capability is not installed, so it is applied here too.
 */
export function applyState(state: VisitorState, root: HTMLElement): void {
  root.setAttribute('data-theme', state.theme);
  root.setAttribute('data-density', state.density);
  root.style.setProperty('--ok-accent', state.accent);
  root.style.setProperty('--ok-font-scale', String(state.fontScale));
  root.toggleAttribute('data-reduce-motion', state.reduceMotion);
  for (const [mode, on] of Object.entries(state.attention)) {
    root.toggleAttribute(`data-attention-${mode.toLowerCase()}`, on);
  }
  root.toggleAttribute('data-school-mode', state.schoolMode);
}
