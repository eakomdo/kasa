import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useUser } from '@/features/auth/session';
import { useDevicePrefs } from '@/features/settings/devicePrefs';
import { qk } from '@/shared/api/queryKeys';
import { practiceModeSchema, type PracticeCard, type PracticeMode } from '@/shared/api/schemas';
import { getLanguage } from '@/shared/config/languages';
import { countsAsCorrect, gradeTyped, type Grade } from '@/shared/lib/grading';
import { track } from '@/shared/lib/analytics';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { createId } from '@/shared/lib/misc';
import { ErrorState, IconButton, ProgressBar, Skeleton, errorMessage, toast } from '@/shared/ui';
import { practiceApi } from '../api';
import { ChoiceView, FeedbackPanel, FlashcardView, TypingView } from '../components/QuestionViews';
import { SessionSummary } from '../components/SessionSummary';
import styles from '../components/Practice.module.css';
import { createSession, sessionReducer } from '../model/session';
import { submitAttempt } from '../outbox';

const MODE_TITLE: Record<PracticeMode, string> = {
  flashcard: 'Flashcards',
  choice: 'Quiz',
  typing: 'Type it',
};

export default function PracticeSessionPage() {
  const user = useUser();
  const [params] = useSearchParams();
  const mode = practiceModeSchema.catch('flashcard').parse(params.get('mode'));
  const unit = params.get('unit');
  const [round, setRound] = useState(0);
  useDocumentTitle(MODE_TITLE[mode]);

  const batch = useQuery({
    queryKey: ['practice', 'batch', user.lang, user.levelId, mode, unit, round],
    queryFn: ({ signal }) =>
      practiceApi.nextBatch({ lang: user.lang, level: user.levelId, unit, limit: user.dailyGoal }, signal),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnReconnect: false,
    networkMode: 'online',
  });

  if (batch.isPending) {
    return (
      <div className={styles.session} aria-busy="true">
        <Skeleton height={14} />
        <Skeleton height={320} radius={24} />
        <Skeleton height={50} radius={14} />
      </div>
    );
  }
  if (batch.error) {
    return (
      <div className={styles.session}>
        <ErrorState error={batch.error} onRetry={() => void batch.refetch()} title="Your cards didn’t load" />
      </div>
    );
  }
  return (
    <SessionRunner
      key={batch.dataUpdatedAt}
      mode={mode}
      unit={unit}
      cards={batch.data.cards}
      onAgain={() => setRound((r) => r + 1)}
    />
  );
}

function SessionRunner({
  mode,
  unit,
  cards,
  onAgain,
}: {
  mode: PracticeMode;
  unit: string | null;
  cards: PracticeCard[];
  onAgain: () => void;
}) {
  const user = useUser();
  const language = getLanguage(user.lang);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const direction = useDevicePrefs((s) => s.cardDirection);
  const [state, dispatch] = useReducer(sessionReducer, undefined, () => createSession(mode, cards));
  const [praise, setPraise] = useState<{ id: number; text: string } | null>(null);

  const card = state.cards[state.index];
  const correctSoFar = state.results.filter((r) => countsAsCorrect(r.grade)).length;

  const record = useCallback(
    (grade: Grade, given?: string) => {
      if (!card) return;
      dispatch({ type: 'answer', grade, given });
      if (countsAsCorrect(grade) && mode === 'flashcard') {
        const n = correctSoFar + 1;
        setPraise({ id: n, text: language.praise[n % language.praise.length]! });
      }
      submitAttempt({
        clientId: createId(),
        itemId: card.id,
        correct: countsAsCorrect(grade),
        mode,
        answeredAt: new Date().toISOString(),
      }).catch((e) => toast(errorMessage(e), 'error'));
    },
    [card, mode, language.praise, correctSoFar],
  );

  // Refresh progress-driven screens once the session ends
  useEffect(() => {
    if (state.phase === 'done') {
      const firstTries = state.results.filter((r) => !r.isRetry);
      if (firstTries.length)
        track('practice_completed', {
          mode,
          cards: firstTries.length,
          accuracy: firstTries.filter((r) => r.grade !== 'wrong').length / firstTries.length,
        });
      void qc.invalidateQueries({ queryKey: qk.progressAll });
      void qc.invalidateQueries({ queryKey: qk.unitsAll });
      void qc.invalidateQueries({ queryKey: ['unit'] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the session ends
  }, [state.phase, qc]);

  // Keyboard shortcuts for laptops and desktop computers in school labs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.phase !== 'question' || !card) return;
      if ((e.target as HTMLElement).matches('input, textarea, select')) return;
      if (mode === 'flashcard') {
        if (e.key === ' ') {
          e.preventDefault();
          dispatch({ type: 'flip' });
        } else if (state.flipped && (e.key === '1' || e.key === '2'))
          record(e.key === '2' ? 'correct' : 'wrong');
      } else if (mode === 'choice') {
        const option = card.options[Number(e.key) - 1];
        if (option) record(option === card.translation ? 'correct' : 'wrong', option);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, state.flipped, card, mode, record]);

  useEffect(() => {
    if (!praise) return;
    const t = window.setTimeout(() => setPraise(null), 700);
    return () => window.clearTimeout(t);
  }, [praise]);

  if (state.phase === 'done' || !card) {
    return (
      <div className={styles.session}>
        <SessionSummary
          results={state.results}
          empty={state.initialCount === 0}
          onAgain={onAgain}
          onHome={() => navigate('/')}
          unit={unit}
        />
      </div>
    );
  }

  return (
    <div className={styles.session}>
      <div className={styles.top}>
        <IconButton icon="close" label="End session" onClick={() => dispatch({ type: 'end' })} />
        <div>
          <ProgressBar
            value={state.index / state.cards.length}
            label="Session progress"
            tone="gold"
            height={14}
          />
        </div>
        <span className={styles.left}>
          {Math.min(state.index + 1, state.cards.length)} / {state.cards.length}
        </span>
      </div>

      {card.isRetry && (
        <p className="small muted" style={{ textAlign: 'center' }}>
          One more try
        </p>
      )}

      {mode === 'flashcard' && (
        <FlashcardView
          key={`card-${state.index}`}
          card={card}
          flipped={state.flipped}
          englishFirst={direction === 'english-first'}
          language={language}
          onFlip={() => dispatch({ type: 'flip' })}
          onAnswer={(g) => record(g)}
        />
      )}
      {mode === 'choice' && (
        <ChoiceView
          key={`card-${state.index}`}
          card={card}
          language={language}
          given={state.given}
          grade={state.grade}
          onAnswer={record}
        />
      )}
      {mode === 'typing' && (
        <TypingView
          key={`card-${state.index}`}
          card={card}
          language={language}
          answered={state.phase === 'feedback'}
          onSubmit={(v) => record(gradeTyped(v, card.translation), v)}
        />
      )}
      {state.phase === 'feedback' && state.grade && (
        <FeedbackPanel
          card={card}
          grade={state.grade}
          praise={language.praise[correctSoFar % language.praise.length]!}
          onNext={() => dispatch({ type: 'next' })}
        />
      )}

      {praise && (
        <div key={`praise-${praise.id}`} className={styles.praise} aria-hidden="true">
          {praise.text}
        </div>
      )}
    </div>
  );
}
