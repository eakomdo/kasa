import { Link } from 'react-router';
import { useUser } from '@/features/auth/session';
import type { PracticeMode } from '@/shared/api/schemas';
import { getLanguage } from '@/shared/config/languages';
import { getBand, getLevel } from '@/shared/config/levels';
import { Icon } from '@/shared/ui';
import styles from './Practice.module.css';

/** The three ways to practise, as a quiet list. Optionally scoped to one unit. */
export function PracticeModes({ unitId }: { unitId?: string }) {
  const user = useUser();
  const language = getLanguage(user.lang);
  const band = getBand(getLevel(user.levelId).band);
  const modes: Array<{ mode: PracticeMode; glyph: string; title: string; text: string }> = [
    {
      mode: 'flashcard',
      glyph: 'Aa',
      title: 'Flashcards',
      text: 'See it, say it, check it. Best for new words.',
    },
    {
      mode: 'choice',
      glyph: '?',
      title: band.examLabel,
      text: 'Pick the right answer from four, like the exam.',
    },
    {
      mode: 'typing',
      glyph: language.letters[0]?.char ?? 'ɛ',
      title: 'Type it',
      text: `Spell it yourself, with ${language.letters.map((l) => l.char).join(' ')} keys built in.`,
    },
  ];
  return (
    <ul className={styles.modes}>
      {modes.map((m) => (
        <li key={m.mode}>
          <Link
            to={`/practice/session?mode=${m.mode}${unitId ? `&unit=${unitId}` : ''}`}
            className={styles.mode}
          >
            <span className={styles.modeIcon} aria-hidden="true">
              {m.glyph}
            </span>
            <span className={styles.modeText}>
              <b>{m.title}</b>
              <span>{m.text}</span>
            </span>
            <Icon name="chevronRight" size={18} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
