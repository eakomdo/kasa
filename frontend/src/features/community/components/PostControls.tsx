import { useState, type FormEvent } from 'react';
import type { ReportReason, VoteValue } from '@/shared/api/schemas';
import { Button, Dialog, Icon, TextArea, errorMessage, toast } from '@/shared/ui';
import { useReport } from '../api';
import styles from '../community.module.css';

export function VoteControl({
  score,
  myVote,
  onVote,
  disabledReason,
  label,
}: {
  score: number;
  myVote: VoteValue;
  onVote: (v: VoteValue) => void;
  /** Set when the learner may not vote (own post, removed). Shown as a tooltip. */
  disabledReason?: string;
  label: string;
}) {
  const disabled = !!disabledReason;
  return (
    <div className={styles.vote} role="group" aria-label={`Votes for ${label}`} title={disabledReason}>
      <button
        type="button"
        className={styles.up}
        aria-pressed={myVote === 1}
        aria-label="Helpful"
        disabled={disabled}
        onClick={() => onVote(myVote === 1 ? 0 : 1)}
      >
        <Icon name="arrowUp" size={18} strokeWidth={2.4} />
      </button>
      <output aria-live="polite" aria-label={`${score} votes`}>
        {score}
      </output>
      <button
        type="button"
        className={styles.down}
        aria-pressed={myVote === -1}
        aria-label="Not helpful"
        disabled={disabled}
        onClick={() => onVote(myVote === -1 ? 0 : -1)}
      >
        <Icon name="arrowDown" size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}

const REASONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: 'bullying', label: 'Unkind or bullying', hint: 'Insults, mocking or making someone feel bad' },
  {
    value: 'personal_info',
    label: 'Personal information',
    hint: 'Phone numbers, addresses, social media, or asking to meet',
  },
  { value: 'inappropriate', label: 'Not suitable for students', hint: 'Rude, adult or upsetting content' },
  {
    value: 'spam',
    label: 'Spam or adverts',
    hint: 'Selling things or posting the same thing again and again',
  },
  {
    value: 'wrong_translation',
    label: 'Wrong Twi or Ga',
    hint: 'A translation or explanation that looks incorrect',
  },
  { value: 'other', label: 'Something else', hint: 'Tell us in the note below' },
];

export function ReportDialog({
  target,
  onClose,
}: {
  target: { type: 'thread' | 'reply'; id: string } | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const report = useReport();

  const close = () => {
    setReason(null);
    setNote('');
    setError(undefined);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    if (!reason) return setError('Choose what’s wrong with this post.');
    if (reason === 'other' && !note.trim()) return setError('Tell us a little about the problem.');
    report.mutate(
      { targetType: target.type, targetId: target.id, reason, note: note.trim() },
      {
        onSuccess: () => {
          toast('Reported. A moderator will review it.');
          close();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog
      open={!!target}
      onClose={close}
      title={target?.type === 'thread' ? 'Report this question' : 'Report this reply'}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <p className="small muted">Reports are private. The person who posted won’t know it was you.</p>
        <fieldset className={styles.reasonList}>
          <legend>What’s wrong?</legend>
          {REASONS.map((r) => (
            <label key={r.value} className={styles.reason}>
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              <span>
                <strong>{r.label}</strong>
                <span className="small muted">{r.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <TextArea
          label="Note for moderators (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
        />
        {error && (
          <p role="alert" className="small" style={{ color: 'var(--danger)', fontWeight: 600 }}>
            {error}
          </p>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" icon="flag" loading={report.isPending}>
            Send report
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
