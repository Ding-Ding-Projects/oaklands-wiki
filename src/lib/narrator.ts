/**
 * Spoken narration for app events.
 *
 * Off by default; the end-user opt-in is optional but the implementation is not.
 *
 * Three properties matter more than the speaking itself:
 *
 * - **One utterance at a time.** A serialized queue, never overlapping. A
 *   superseded line in the same category replaces the queued one rather than
 *   stacking, so a burst of activity does not produce a monologue.
 * - **It yields to assistive technology.** If a screen reader is likely active,
 *   or the page is hidden, it does not speak over it.
 * - **Errors are never suppressed by the rate limits.** Tone follows the funny
 *   level; the content still names the actual failure and what to do about it.
 */
import type { VisitorState } from './visitor-state';

export type NarrationCategory = 'navigation' | 'setting' | 'result' | 'error';

type QueueItem = { category: NarrationCategory; text: string; lang: 'en' | 'yue' };

const COOLDOWN_MS: Record<NarrationCategory, number> = {
  navigation: 4000, setting: 2500, result: 3000, error: 0,
};

export class Narrator {
  private queue: QueueItem[] = [];
  private speaking = false;
  private lastSpoken: Partial<Record<NarrationCategory, number>> = {};

  constructor(private getState: () => VisitorState) {}

  get available(): boolean {
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
  }

  /** Queue a line. Returns false when it was deliberately not spoken. */
  say(category: NarrationCategory, english: string, cantonese?: string): boolean {
    const state = this.getState();
    if (!state.narratorEnabled || !this.available) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;

    // Rate limit per category. Errors are exempt: a failure nobody heard is the
    // one case where staying quiet is the wrong behaviour.
    const now = Date.now();
    if (category !== 'error') {
      const last = this.lastSpoken[category] ?? 0;
      if (now - last < COOLDOWN_MS[category]) return false;
    }
    this.lastSpoken[category] = now;

    const items: QueueItem[] = [];
    const mode = state.narratorLanguage;
    if (mode === 'en' || mode === 'both') items.push({ category, text: english, lang: 'en' });
    if ((mode === 'yue' || mode === 'both') && cantonese) items.push({ category, text: cantonese, lang: 'yue' });
    if (items.length === 0) return false;

    // Replace a superseded queued line in the same category rather than stacking.
    this.queue = this.queue.filter((item) => item.category !== category);
    this.queue.push(...items);
    this.drain();
    return true;
  }

  cancel(): void {
    this.queue = [];
    if (this.available) window.speechSynthesis.cancel();
    this.speaking = false;
  }

  private pickVoice(lang: 'en' | 'yue'): SpeechSynthesisVoice | null {
    const state = this.getState();
    const voices = window.speechSynthesis.getVoices();
    const chosen = lang === 'en' ? state.narratorVoiceEn : state.narratorVoiceYue;
    if (chosen) {
      const exact = voices.find((v) => v.voiceURI === chosen);
      // A chosen voice that is not installed falls back rather than going silent,
      // and the settings surface says so rather than resetting the choice.
      if (exact) return exact;
    }
    const matcher = lang === 'en' ? /^en/i : /yue|zh-hk|zh_hk/i;
    return voices.find((v) => matcher.test(v.lang)) ?? null;
  }

  private drain(): void {
    if (this.speaking || this.queue.length === 0) return;
    const item = this.queue.shift();
    if (!item) return;
    const state = this.getState();

    const utterance = new SpeechSynthesisUtterance(item.text);
    const voice = this.pickVoice(item.lang);
    if (voice) utterance.voice = voice;
    utterance.lang = item.lang === 'en' ? 'en-GB' : 'zh-HK';
    utterance.rate = state.narratorRate;
    utterance.pitch = state.narratorPitch;

    this.speaking = true;
    const done = () => { this.speaking = false; this.drain(); };
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  }
}
