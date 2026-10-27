import { useUser } from '@/features/auth/session';
import { VocabList } from '@/features/curriculum/components/VocabList';
import { useProgressSummary } from '@/features/progress/api';
import { getLanguage } from '@/shared/config/languages';
import { xpFor } from '@/shared/lib/srs';
import { Button, ButtonLink, EmptyState, Section, Stat, StatGrid } from '@/shared/ui';
import { summarise, type SessionResult } from '../model/session';
import styles from './Practice.module.css';

export function SessionSummary({
  results,
  empty,
  unit,
  onAgain,
  onHome,
}: {
  results: SessionResult[];
  empty: boolean;
  unit: string | null;
  onAgain: () => void;
  onHome: () => void;
}) {
  const user = useUser();
  const language = getLanguage(user.lang);
  const { data: progress } = useProgressSummary();

  if (empty) {
    return (
      <EmptyState
        icon="check"
        title={`${language.cheer} Nothing due right now`}
        action={
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <ButtonLink to="/learn" size="sm">
              Browse units
            </ButtonLink>
            <ButtonLink to="/lookup" size="sm" variant="ghost">
              Look up a word
            </ButtonLink>
          </div>
        }
      >
        Every word you’ve studied is resting until its next review. Come back tomorrow, or start a new unit.
      </EmptyState>
    );
  }

  const s = summarise(results);
  const xp = results.reduce((sum, r) => sum + xpFor(r.grade !== 'wrong'), 0);
  const headline =
    s.total === 0
      ? 'Session ended'
      : s.accuracy >= 0.8
        ? language.cheer
        : s.accuracy >= 0.5
          ? language.praise[0]
          : user.lang === 'twi'
            ? 'Kɔ so!'
            : 'Keep going!';
  const line =
    s.total === 0
      ? 'No cards answered this time. Come back when you’re ready.'
      : s.accuracy >= 0.8
        ? 'Strong session. Those words are sticking.'
        : s.accuracy >= 0.5
          ? 'Good work. The tricky ones will come back sooner so you can lock them in.'
          : 'Keep going. Every miss tells Kasa what to show you again.';
  const today = progress?.todayCount ?? 0;
  const goalHit = today >= user.dailyGoal;

  return (
    <div className={`stack ${styles.summary}`} style={{ gap: 32 }}>
      <div className="stack-sm" style={{ alignItems: 'center' }}>
        <p className={styles.cheer} lang={user.lang === 'twi' ? 'tw' : 'gaa'}>
          {headline}
        </p>
        <p className="muted" style={{ maxWidth: '34ch' }}>
          {line}
        </p>
      </div>
      <StatGrid>
        <Stat value={`${s.remembered}/${s.total}`} label="remembered" />
        <Stat value={`+${xp}`} label="XP" />
        <Stat value={progress?.streak ?? '–'} label="day streak" />
      </StatGrid>
      <p className="small muted">
        {goalHit
          ? `Daily goal reached: ${today} cards today. Your streak is safe.`
          : `${Math.max(0, user.dailyGoal - today)} more cards to reach today’s goal.`}
      </p>
      {s.toReview.length > 0 && (
        <div style={{ width: '100%', textAlign: 'left' }}>
          <Section label="Words to watch">
            <VocabList
              showMastery={false}
              items={s.toReview.map((r) => ({
                id: r.itemId,
                unitId: unit,
                lang: user.lang,
                kind: 'word',
                english: r.english,
                translation: r.translation,
                audioUrl: null,
                mastery: null,
              }))}
            />
          </Section>
        </div>
      )}
      <div className="stack-sm" style={{ width: '100%' }}>
        <Button block onClick={goalHit ? onHome : onAgain}>
          {goalHit ? 'Done for today' : 'Keep going'}
        </Button>
        <Button block variant="ghost" onClick={goalHit ? onAgain : onHome}>
          {goalHit ? 'Practise more' : 'Back to Today'}
        </Button>
      </div>
    </div>
  );
}
