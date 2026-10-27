import { useState } from 'react';
import type { Suggestion } from '@/shared/api/schemas';
import { getLanguage } from '@/shared/config/languages';
import { timeAgo } from '@/shared/lib/date';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { plural } from '@/shared/lib/misc';
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  Skeleton,
  TextField,
  errorMessage,
  toast,
} from '@/shared/ui';
import { useReviewSuggestion, useSuggestions, type SuggestionStatus } from '../api';
import styles from '../admin.module.css';

const STATUS_OPTIONS: Array<{ value: SuggestionStatus; label: string }> = [
  { value: 'pending', label: 'To review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function SuggestionItem({
  s,
  onApprove,
  onReject,
}: {
  s: Suggestion;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <li className={styles.item}>
      <div className="row-between">
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Chip tone="info">{getLanguage(s.lang).name}</Chip>
          {s.supporters > 0 && <Chip tone="ok">{`${plural(s.supporters, 'other learner')} agree`}</Chip>}
        </div>
        <span className="small muted">
          {s.submittedBy} · {timeAgo(s.createdAt)}
        </span>
      </div>
      <p>
        English: <strong>“{s.query}”</strong>
      </p>
      <div className={styles.compare}>
        <div className={styles.compareBox}>
          <span className="eyebrow">Kasa says now</span>
          <span className={styles.word}>{s.currentTranslation ?? 'No translation yet'}</span>
        </div>
        <div className={`${styles.compareBox} ${styles.proposed}`}>
          <span className="eyebrow">{s.status === 'approved' ? 'Approved' : 'Suggested'}</span>
          <span className={styles.word}>{s.suggestion}</span>
        </div>
      </div>
      {s.status === 'pending' && (
        <div className={styles.actions}>
          <Button size="sm" icon="check" onClick={onApprove}>
            Approve
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject}>
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}

export default function SuggestionsPage() {
  useDocumentTitle('Translations');
  const [status, setStatus] = useState<SuggestionStatus>('pending');
  const list = useSuggestions(status);
  const review = useReviewSuggestion();
  const [approving, setApproving] = useState<Suggestion | null>(null);
  const [finalText, setFinalText] = useState('');

  const reject = (s: Suggestion) =>
    review.mutate(
      { id: s.id, decision: 'reject' },
      { onSuccess: () => toast('Suggestion rejected.'), onError: (e) => toast(errorMessage(e), 'error') },
    );

  const approve = () => {
    if (!approving) return;
    const text = finalText.trim();
    review.mutate(
      { id: approving.id, decision: 'approve', finalTranslation: text || undefined },
      {
        onSuccess: () =>
          toast(`Approved. Lookup now shows “${text || approving.suggestion}” as checked by teachers.`),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );
    setApproving(null);
  };

  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Translations"
        subtitle="Learners suggest better Twi and Ga. Approved translations appear in lookup as checked by teachers."
      />
      <Segmented label="Suggestion status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      {list.isPending ? (
        <div className="stack">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={180} />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="translate"
          title={status === 'pending' ? 'No suggestions waiting' : `No ${status} suggestions yet`}
        >
          {status === 'pending'
            ? 'When learners suggest a better translation in lookup, it lands here.'
            : undefined}
        </EmptyState>
      ) : (
        <ul className={styles.queue}>
          {items.map((s) => (
            <SuggestionItem
              key={s.id}
              s={s}
              onApprove={() => {
                setApproving(s);
                setFinalText(s.suggestion);
              }}
              onReject={() => reject(s)}
            />
          ))}
        </ul>
      )}

      <Dialog open={!!approving} onClose={() => setApproving(null)} title="Approve this translation">
        {approving && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              approve();
            }}
          >
            <p>
              For “<strong>{approving.query}</strong>” in {getLanguage(approving.lang).fullName}. Edit the
              wording if it needs a fix before learners see it.
            </p>
            <TextField
              label="Final translation"
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              maxLength={300}
              autoFocus
            />
            <p className="small muted">Only approve translations a native-speaking teacher has checked.</p>
            <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => setApproving(null)}>
                Cancel
              </Button>
              <Button type="submit" icon="check" disabled={!finalText.trim()}>
                Approve
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
