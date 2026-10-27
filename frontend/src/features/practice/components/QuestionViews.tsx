import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AudioButton } from '@/features/audio/AudioButton';
import type { Language } from '@/shared/config/languages';
import type { Grade } from '@/shared/lib/grading';
import { Button } from '@/shared/ui';
import type { SessionCard } from '../model/session';
import styles from './Practice.module.css';

const langAttr = (card: SessionCard) => (card.lang === 'twi' ? 'tw' : 'gaa');

/* ---------- Flashcard ---------- */
export function FlashcardView({
  card,
  flipped,
  englishFirst,
  language,
  onFlip,
  onAnswer,
}: {
  card: SessionCard;
  flipped: boolean;
  englishFirst: boolean;
  language: Language;
  onFlip: () => void;
  onAnswer: (grade: Grade) => void;
}) {
  const front = englishFirst ? card.english : card.translation;
  const back = englishFirst ? card.translation : card.english;
  return (
    <>
      <button
        type="button"
        className={styles.stage}
        data-revealed={flipped}
        onClick={onFlip}
        aria-label={
          flipped ? `${front} means ${back}. Tap to hide the answer.` : `${front}. Tap to reveal the answer.`
        }
      >
        <span className="eyebrow">{englishFirst ? 'English' : language.name}</span>
        <span className={styles.word} lang={englishFirst ? 'en' : langAttr(card)}>
          {front}
        </span>
        <span className={styles.rule} aria-hidden="true" />
        <span className={styles.meaning} lang={englishFirst ? langAttr(card) : 'en'} aria-hidden={!flipped}>
          {flipped ? back : 'Say it out loud, then tap to check'}
        </span>
      </button>
      {flipped && (
        <div className={styles.audioRow}>
          <AudioButton item={card} />
        </div>
      )}
      <div className={styles.bottom}>
        {flipped ? (
          <>
            <p className={styles.ask}>Did you remember it?</p>
            <div className={styles.answerRow}>
              <Button variant="ghost" onClick={() => onAnswer('wrong')}>
                Not yet
              </Button>
              <Button onClick={() => onAnswer('correct')}>Got it</Button>
            </div>
          </>
        ) : (
          <Button variant="ghost" block onClick={onFlip}>
            Show answer
          </Button>
        )}
        <p className={`${styles.shortcuts} desktop-only`}>Space to reveal · 1 not yet · 2 got it</p>
      </div>
    </>
  );
}

/* ---------- Multiple choice ---------- */
export function ChoiceView({
  card,
  language,
  given,
  grade,
  onAnswer,
}: {
  card: SessionCard;
  language: Language;
  given: string | null;
  grade: Grade | null;
  onAnswer: (grade: Grade, given: string) => void;
}) {
  const answered = grade !== null;
  return (
    <>
      <div className={styles.prompt}>
        <p className="eyebrow">Which is the {language.name} for</p>
        <p className={styles.word}>{card.english}</p>
      </div>
      <div className={styles.options} role="group" aria-label="Answer options">
        {card.options.map((o, i) => {
          const state = answered
            ? o === card.translation
              ? 'right'
              : o === given
                ? 'wrong'
                : undefined
            : undefined;
          return (
            <button
              key={o}
              type="button"
              className={styles.option}
              data-state={state}
              disabled={answered}
              lang={langAttr(card)}
              onClick={() => onAnswer(o === card.translation ? 'correct' : 'wrong', o)}
            >
              <kbd className="desktop-only" aria-hidden="true">
                {i + 1}
              </kbd>
              {o}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Typing ---------- */
export function TypingView({
  card,
  language,
  answered,
  onSubmit,
}: {
  card: SessionCard;
  language: Language;
  answered: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!answered) input.current?.focus();
  }, [answered]);

  const insert = (ch: string) => {
    const el = input.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!answered && value.trim()) onSubmit(value);
  };

  return (
    <>
      <div className={styles.prompt}>
        <p className="eyebrow">Type the {language.name} for</p>
        <p className={styles.word}>{card.english}</p>
      </div>
      <form className="stack-sm" onSubmit={submit} autoComplete="off">
        <label htmlFor="typed-answer" className="visually-hidden">
          Your answer in {language.name}
        </label>
        <input
          id="typed-answer"
          ref={input}
          className={styles.typeInput}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={answered}
          placeholder={`Type in ${language.name}`}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          lang={langAttr(card)}
        />
        {!answered && (
          <>
            <div className={styles.keys} role="group" aria-label={`${language.name} letters`}>
              {language.keys.map((k) => (
                <button key={k} type="button" onClick={() => insert(k)} aria-label={`Insert ${k}`}>
                  {k}
                </button>
              ))}
            </div>
            <Button type="submit" block disabled={!value.trim()}>
              Check
            </Button>
          </>
        )}
      </form>
    </>
  );
}

/* ---------- Feedback after choice/typing ---------- */
export function FeedbackPanel({
  card,
  grade,
  praise,
  onNext,
}: {
  card: SessionCard;
  grade: Grade;
  praise: string;
  onNext: () => void;
}) {
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus(), []);
  const heading =
    grade === 'correct'
      ? praise
      : grade === 'almost'
        ? 'Almost! Watch the spelling.'
        : 'Not quite. Here’s the answer:';
  return (
    <>
      <div className={styles.feedback} data-grade={grade} role="status">
        <div className={styles.feedbackText}>
          <strong>{heading}</strong>
          <p className={styles.feedbackAnswer} lang={langAttr(card)}>
            {card.translation}
          </p>
          {card.isRetry && grade === 'wrong' && (
            <p className="small">This one will come back in your next session.</p>
          )}
        </div>
        <AudioButton item={card} />
      </div>
      <Button ref={next} block onClick={onNext}>
        Continue
      </Button>
    </>
  );
}
