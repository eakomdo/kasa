import { AudioButton } from '@/features/audio/AudioButton';
import type { VocabItem } from '@/shared/api/schemas';
import { LEARNED_AT, MASTERED_AT } from '@/shared/lib/srs';
import styles from './Curriculum.module.css';

const levelOf = (m: number | null) =>
  m === null ? 'new' : m >= MASTERED_AT ? 'mastered' : m >= LEARNED_AT ? 'learning' : 'new';
const LEVEL_LABEL = { new: 'New', learning: 'Learning', mastered: 'Mastered' } as const;

export function VocabList({ items, showMastery = true }: { items: VocabItem[]; showMastery?: boolean }) {
  return (
    <ul className={styles.vocabList}>
      {items.map((it) => {
        const level = levelOf(it.mastery);
        return (
          <li key={it.id} className={styles.vocab}>
            {showMastery && (
              <span
                className={styles.pip}
                data-level={level}
                title={LEVEL_LABEL[level]}
                aria-label={LEVEL_LABEL[level]}
                role="img"
              />
            )}
            <span className={styles.vocabText}>
              <span className={styles.vocabLocal} lang={it.lang === 'twi' ? 'tw' : 'gaa'}>
                {it.translation}
              </span>
              <span className={styles.vocabEnglish}>{it.english}</span>
            </span>
            <AudioButton item={it} />
          </li>
        );
      })}
    </ul>
  );
}

export function MasteryLegend() {
  return (
    <p className={styles.legend} aria-hidden="true">
      <span>
        <span className={styles.pip} data-level="new" /> New
      </span>
      <span>
        <span className={styles.pip} data-level="learning" /> Learning
      </span>
      <span>
        <span className={styles.pip} data-level="mastered" /> Mastered
      </span>
    </p>
  );
}
