/**
 * Languages Kasa teaches. Adding one (Ewe, Fante, Dagbani…) means adding an
 * entry here, curriculum on the server, and the matching Khaya AI codes.
 */
export type LanguageId = 'twi' | 'ga';

export interface Language {
  id: LanguageId;
  name: string;
  fullName: string;
  /** "ready" = teacher-verified content; "review" = awaiting native-speaker review */
  status: 'ready' | 'review';
  blurb: string;
  /** Codes the backend passes to Khaya AI (GhanaNLP) per service */
  khaya: { translate: string; tts: string; asr: string };
  /** Letters beyond the English alphabet, with a plain-English hint */
  letters: ReadonlyArray<{ char: string; hint: string }>;
  /** On-screen keys for typing practice; phone keyboards rarely have these */
  keys: readonly string[];
  /** Short praise shown after correct answers */
  praise: readonly string[];
  /** Headline for a strong session */
  cheer: string;
  thanks: string;
  greeting: (name: string, hour: number) => string;
  /** Short weekday labels, Sunday first */
  weekdays: readonly string[];
}

export const LANGUAGES: Record<LanguageId, Language> = {
  twi: {
    id: 'twi',
    name: 'Twi',
    fullName: 'Asante Twi',
    status: 'ready',
    blurb: 'The most widely spoken Akan language in Ghana',
    khaya: { translate: 'tw', tts: 'twi', asr: 'twi' },
    letters: [
      { char: 'ɛ', hint: 'like “e” in bed' },
      { char: 'ɔ', hint: 'like “o” in pot' },
    ],
    keys: ['ɛ', 'ɔ', 'Ɛ', 'Ɔ'],
    praise: ['Mo!', 'Ayekoo!', 'Kɔ so!', 'Wayɛ adeɛ!'],
    cheer: 'Ayekoo!',
    thanks: 'Medaase',
    greeting: (name, hour) => `${hour < 12 ? 'Maakye' : hour < 17 ? 'Maaha' : 'Maadwo'}, ${name}`,
    weekdays: ['Kwa', 'Dwo', 'Ben', 'Wuk', 'Yaw', 'Fia', 'Mem'],
  },
  ga: {
    id: 'ga',
    name: 'Ga',
    fullName: 'Ga',
    status: 'review',
    blurb: 'Spoken across Greater Accra',
    khaya: { translate: 'gaa', tts: 'gaa', asr: 'gaa' },
    letters: [
      { char: 'ɛ', hint: 'like “e” in bed' },
      { char: 'ɔ', hint: 'like “o” in pot' },
      { char: 'ŋ', hint: 'like “ng” in sing' },
    ],
    keys: ['ɛ', 'ɔ', 'ŋ', 'Ɛ', 'Ɔ', 'Ŋ'],
    praise: ['Ojekoo!', 'Ojogbaŋŋ!'],
    cheer: 'Ojekoo!',
    thanks: 'Oyiwaladɔŋŋ',
    greeting: (name) => `Te oyɔɔ tɛŋŋ, ${name}?`,
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
};

export const LANGUAGE_LIST = Object.values(LANGUAGES);
export const getLanguage = (id: LanguageId): Language => LANGUAGES[id];
