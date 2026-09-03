/**
 * Language modes and funny levels.
 *
 * Three modes: English, playful Hong Kong Cantonese, and bilingual. Two
 * independent funny sliders, one per language, both shipping at 5.
 *
 * The funny level styles the VOICE and never the FACTS. Every entry below says
 * the same thing at every level: which file, which count, what a control will
 * do. A warning nobody can act on is a broken warning, not a funny one — so the
 * playful variants wrap the fact, they do not replace it.
 */
import type { FunnyLevel, LanguageMode, VisitorState } from './visitor-state';

/** Five English variants and five Cantonese variants for one string. */
type Entry = { en: [string, string, string, string, string]; yue: [string, string, string, string, string] };

const five = (serious: string, playful: string): [string, string, string, string, string] =>
  [serious, serious, playful, playful, playful];

export const STRINGS = {
  'settings.title': {
    en: ['Settings', 'Settings', 'Settings', 'Your settings', 'Make it yours'],
    yue: ['設定', '設定', '設定', '你嘅設定', '整返隻你鍾意嘅'],
  },
  'settings.saved': {
    en: five('Saved.', 'Saved. This browser will remember.'),
    yue: five('已儲存。', '記住咗喇，下次返嚟一樣。'),
  },
  'settings.storageBlocked': {
    en: five(
      'This browser refused to store the setting. It applies now but will not be remembered.',
      'Your browser said no to saving. It works for this visit and forgets you afterwards.',
    ),
    yue: five(
      '瀏覽器唔畀儲存。今次用得，但下次唔會記得。',
      '個瀏覽器唔畀我記低。今次照用，行開就唔記得你。',
    ),
  },
  'settings.reset': {
    en: five('Reset everything', 'Put it all back the way it came'),
    yue: five('全部重設', '全部打返原形'),
  },
  'language.label': { en: five('Language', 'Language'), yue: five('語言', '語言') },
  'funny.english': {
    en: ['English funny level', 'English funny level', 'English funny level', 'How silly, in English', 'How silly, in English'],
    yue: five('英文搞笑程度', '英文可以幾癲'),
  },
  'funny.cantonese': {
    en: five('Cantonese funny level', 'How silly, in Cantonese'),
    yue: five('中文搞笑程度', '中文可以幾癲'),
  },
  'funny.hint': {
    en: five(
      'Styles the wording of every message, including errors. The facts never change.',
      'Changes how everything is worded, errors included. What actually happened stays exact.',
    ),
    yue: five(
      '會改所有訊息嘅語氣，錯誤訊息都包。事實本身唔會變。',
      '會改晒所有字嘅語氣，連報錯都一樣。但發生咗乜嘢，一個字都唔會走樣。',
    ),
  },
  'emoji.label': {
    en: five('Show emoji in dialogs', 'Let dialogs wear emoji'),
    yue: five('對話框顯示 emoji', '畀對話框戴 emoji'),
  },
  'emoji.hint': {
    en: five(
      'Decoration only. Emoji never appear in buttons, labels or accessible names.',
      'Pure decoration. Buttons and labels stay plain, so nothing important rides on a picture.',
    ),
    yue: five(
      '純裝飾。掣同標籤唔會有，重要嘢唔會靠個公仔嚟講。',
      '純粹好睇。掣同標籤照樣乾淨，緊要嘢唔會靠隻公仔講。',
    ),
  },
  'appearance.title': { en: five('Appearance', 'How it looks'), yue: five('外觀', '個樣點') },
  'appearance.theme': { en: five('Theme', 'Light or dark'), yue: five('主題', '光定黑') },
  'appearance.density': { en: five('Density', 'Roomy or tight'), yue: five('密度', '疏定密') },
  'appearance.accent': { en: five('Accent colour', 'Pick a colour'), yue: five('主色', '揀隻色') },
  'appearance.fontScale': { en: five('Text size', 'How big the text is'), yue: five('字級', '隻字幾大') },
  'appearance.reduceMotion': { en: five('Reduce motion', 'Calm things down'), yue: five('減少動態', '靜啲') },
  'attention.title': {
    en: five('Attention modes', 'Attention modes'),
    yue: five('專注模式', '專注模式'),
  },
  'attention.hint': {
    en: five(
      'Interface accommodations, off by default and independently switchable. Not medical, and not a claim about you.',
      'Interface accommodations, all off unless you want them, each on its own switch. Not medical, and not a claim about you.',
    ),
    yue: five(
      '介面上嘅遷就，預設全部關，逐個開得。唔係醫療，亦唔係講緊你係點。',
      '介面遷就，預設全關，逐個掣自己揀。唔係醫療，更加唔係講你乜。',
    ),
  },
  'school.name': { en: five('Mode name', 'What to call it'), yue: five('模式名稱', '叫佢做乜') },
  'narrator.title': { en: five('Narrator', 'Read it aloud'), yue: five('朗讀', '讀出嚟') },
  'nothing.matches': {
    en: five('Nothing matches.', 'Nothing matches. Try fewer letters.'),
    yue: five('無結果。', '無嘢啱。試下打少幾個字。'),
  },
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

function pick(entry: Entry, language: 'en' | 'yue', level: FunnyLevel): string {
  return entry[language][level - 1];
}

/**
 * Resolve one string for the visitor's current settings.
 *
 * Bilingual mode returns both, primary first, so a caller can render the second
 * as a compact secondary label rather than crowding the interface.
 */
export function translate(
  key: StringKey,
  state: Pick<VisitorState, 'language' | 'funnyEnglish' | 'funnyCantonese' | 'schoolMode'>,
): { primary: string; secondary: string | null } {
  const entry = STRINGS[key] as Entry;

  // School mode forces English presentation and makes the Cantonese and
  // funny-level capabilities behave as though they are not installed.
  if (state.schoolMode) return { primary: entry.en[0], secondary: null };

  const language: LanguageMode = state.language;
  if (language === 'en') return { primary: pick(entry, 'en', state.funnyEnglish), secondary: null };
  if (language === 'yue') return { primary: pick(entry, 'yue', state.funnyCantonese), secondary: null };
  return {
    primary: pick(entry, 'en', state.funnyEnglish),
    secondary: pick(entry, 'yue', state.funnyCantonese),
  };
}

/** Every key, for the coverage guard. Hand-checked against STRINGS at build time. */
export const STRING_KEYS = Object.keys(STRINGS) as StringKey[];
