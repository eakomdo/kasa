import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AudioButton } from '@/features/audio/AudioButton';
import { useUser } from '@/features/auth/session';
import { VocabList } from '@/features/curriculum/components/VocabList';
import type { LookupResult } from '@/shared/api/schemas';
import { getLanguage } from '@/shared/config/languages';
import { track } from '@/shared/lib/analytics';
import { normalizeAnswer } from '@/shared/lib/grading';
import { useDocumentTitle, useOnline } from '@/shared/lib/hooks';
import { safeStorage } from '@/shared/lib/misc';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  List,
  ListRow,
  Notice,
  PageHeader,
  Section,
  Skeleton,
  Spinner,
  TextArea,
  errorMessage,
  toast,
} from '@/shared/ui';
import { useAddToDeck, useLookup, useSuggestTranslation } from './api';
import styles from './Lookup.module.css';

const RECENT_KEY = 'kasa-recent-lookups';
const EXAMPLES = {
  twi: ['Thank you', 'How much is it?', 'Friend', 'I am hungry', 'Medaase'],
  ga: ['Thank you', 'What is your name?', 'Friend', 'Water', 'Ojekoo'],
};

export default function LookupPage() {
  useDocumentTitle('Lookup');
  const user = useUser();
  const language = getLanguage(user.lang);
  const online = useOnline();
  const lookup = useLookup(user.lang);
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(() => params.get('q') ?? '');
  const [recent, setRecent] = useState<string[]>(() => safeStorage.get(`${RECENT_KEY}-${user.lang}`, []));
  const [suggesting, setSuggesting] = useState(false);

  const run = (q: string) => {
    const query = q.trim();
    if (!query) return;
    setText(query);
    lookup.mutate(query, {
      onSuccess: (r) => track('lookup_performed', { lang: user.lang, source: r.result?.source ?? 'none' }),
    });
    const next = [query, ...recent.filter((r) => normalizeAnswer(r) !== normalizeAnswer(query))].slice(0, 6);
    setRecent(next);
    safeStorage.set(`${RECENT_KEY}-${user.lang}`, next);
  };

  // Searches started from the top bar arrive as ?q=; run them once, then clear the param
  const initialQuery = useRef(params.get('q'));
  useEffect(() => {
    const q = initialQuery.current;
    if (!q) return;
    initialQuery.current = null;
    run(q);
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per arrival
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(text);
  };

  return (
    <div className="stack" style={{ gap: 32, maxWidth: 'var(--reading-max)' }}>
      <PageHeader title="Lookup" subtitle={`English and ${language.fullName}, both ways`} />

      <form className={styles.search} role="search" onSubmit={onSubmit}>
        <label htmlFor="lookup-input" className="visually-hidden">
          Word or phrase in English or {language.name}
        </label>
        <Icon name="search" size={20} />
        <input
          id="lookup-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Type English or ${language.name}`}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={200}
        />
        {lookup.isPending && <Spinner label="Translating" />}
      </form>

      {!online && (
        <Notice tone="warn" icon="cloudOff">
          Lookup needs data. Words from units you saved offline are still in Learn.
        </Notice>
      )}

      {lookup.isPending ? (
        <div className="stack-sm" aria-busy="true">
          <Skeleton height={40} width="55%" />
          <Skeleton width="35%" />
        </div>
      ) : lookup.error ? (
        <ErrorState error={lookup.error} onRetry={() => run(text)} />
      ) : lookup.data ? (
        <Result data={lookup.data} onSuggest={() => setSuggesting(true)} />
      ) : (
        <Section label={recent.length ? 'Recent' : 'Try'}>
          <List>
            {(recent.length ? recent : EXAMPLES[user.lang]).map((q) => (
              <ListRow
                key={q}
                title={q}
                onClick={() => run(q)}
                end={<Icon name="chevronRight" size={18} />}
              />
            ))}
          </List>
        </Section>
      )}

      {lookup.data && lookup.data.related.length > 0 && !lookup.isPending && (
        <Section label="From your units">
          <VocabList items={lookup.data.related} showMastery={false} />
        </Section>
      )}

      <p className="small muted">
        Translations improve as our community grows. Answers marked as checked by teachers come from the
        syllabus; the rest come from Khaya AI by GhanaNLP.
      </p>

      {lookup.data && (
        <SuggestDialog
          open={suggesting}
          onClose={() => setSuggesting(false)}
          data={lookup.data}
          lang={user.lang}
          languageName={language.name}
          thanks={language.thanks}
        />
      )}
    </div>
  );
}

function Result({ data, onSuggest }: { data: LookupResult; onSuggest: () => void }) {
  const user = useUser();
  const language = getLanguage(user.lang);
  const addToDeck = useAddToDeck();
  const [added, setAdded] = useState(false);

  if (!data.result) {
    return (
      <EmptyState
        icon="search"
        title={`No translation for “${data.query}” yet`}
        action={
          <Button variant="ghost" size="sm" onClick={onSuggest}>
            Suggest a translation
          </Button>
        }
      >
        Try a shorter phrase or check the spelling. If you know the answer, suggest it and a teacher will
        review it.
      </EmptyState>
    );
  }

  const r = data.result;
  const verified = r.source === 'curriculum';
  const toLocal = data.direction === 'to_local';
  return (
    <section className={styles.result} aria-live="polite">
      <p className="small muted">
        {toLocal ? `English → ${language.name}` : `${language.name} → English`} · “{data.query}”
      </p>
      <div className={styles.output}>
        <p lang={toLocal ? (user.lang === 'twi' ? 'tw' : 'gaa') : 'en'}>{r.output}</p>
        {toLocal && <AudioButton item={{ translation: r.output, audioUrl: null, lang: user.lang }} />}
      </div>
      <p className={verified ? styles.verified : styles.machine}>
        <Icon name={verified ? 'check' : 'sparkle'} size={15} />
        {verified ? 'Checked by teachers' : 'Khaya AI translation, not yet checked'}
        {r.unitId && (
          <>
            {' · '}
            <Link to={`/learn/${r.unitId}`}>see the unit</Link>
          </>
        )}
      </p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 20 }}>
        {r.itemId && (
          <Button
            size="sm"
            icon={added ? 'check' : 'plus'}
            disabled={added}
            loading={addToDeck.isPending}
            onClick={() =>
              addToDeck.mutate(r.itemId!, {
                onSuccess: () => {
                  setAdded(true);
                  toast('Added. It’ll show up in your next session.');
                },
                onError: (e) => toast(errorMessage(e), 'error'),
              })
            }
          >
            {added ? 'In your practice deck' : 'Add to practice'}
          </Button>
        )}
        <button type="button" className="text-button small" onClick={onSuggest}>
          Suggest a better translation
        </button>
      </div>
    </section>
  );
}

function SuggestDialog({
  open,
  onClose,
  data,
  lang,
  languageName,
  thanks,
}: {
  open: boolean;
  onClose: () => void;
  data: LookupResult;
  lang: 'twi' | 'ga';
  languageName: string;
  thanks: string;
}) {
  const suggest = useSuggestTranslation();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError(`Type how you would say it in ${languageName}.`);
      return;
    }
    suggest.mutate(
      { lang, query: data.query, suggestion: value.trim(), currentTranslation: data.result?.output ?? null },
      {
        onSuccess: () => {
          toast(`${thanks}! A teacher will review your suggestion.`);
          setValue('');
          onClose();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Suggest a translation">
      <form className="stack" onSubmit={submit}>
        <p className="muted">
          How would you say “{data.query}” in {languageName}? Teachers review every suggestion before it
          reaches other learners.
        </p>
        <TextArea
          label="Your translation"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          maxLength={300}
          error={error}
          rows={3}
        />
        <Button type="submit" block loading={suggest.isPending}>
          Send suggestion
        </Button>
      </form>
    </Dialog>
  );
}
