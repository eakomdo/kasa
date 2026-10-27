import { useState } from 'react';
import { Link } from 'react-router';
import type { Report, ReportAction } from '@/shared/api/schemas';
import { timeAgo } from '@/shared/lib/date';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { cn, plural } from '@/shared/lib/misc';
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  ErrorState,
  Notice,
  PageHeader,
  Segmented,
  Skeleton,
  TextArea,
  errorMessage,
  toast,
} from '@/shared/ui';
import { REASON_LABELS, useReports, useResolveReport, type ReportStatus } from '../api';
import styles from '../admin.module.css';

const ACTION_COPY: Record<
  ReportAction,
  { label: string; title: string; body: string; done: string; variant: 'ghost' | 'danger' | 'subtle' }
> = {
  dismiss: {
    label: 'Dismiss',
    title: 'Dismiss this report?',
    body: 'The post stays up. Use this when the post follows the rules.',
    done: 'Report dismissed.',
    variant: 'ghost',
  },
  remove_content: {
    label: 'Remove post',
    title: 'Remove this post?',
    body: 'Learners will see “Removed by a moderator” in its place.',
    done: 'Post removed.',
    variant: 'danger',
  },
  warn_user: {
    label: 'Warn author',
    title: 'Warn the author?',
    body: 'The post stays up and the author gets a reminder of the community rules.',
    done: 'Author warned.',
    variant: 'subtle',
  },
  suspend_user: {
    label: 'Suspend author',
    title: 'Remove the post and suspend the author?',
    body: 'They can keep learning, but can’t post, reply or vote until an admin reactivates them.',
    done: 'Post removed and author suspended.',
    variant: 'danger',
  },
};

const SEVERE = new Set<Report['reason']>(['personal_info', 'bullying', 'inappropriate']);

const STATUS_OPTIONS: Array<{ value: ReportStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

function ReportItem({ report, onAct }: { report: Report; onAct: (a: ReportAction) => void }) {
  const severe = SEVERE.has(report.reason);
  return (
    <li className={cn(styles.item, report.status === 'open' && (severe ? styles.sevHigh : styles.sevMid))}>
      <div className="row-between">
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Chip tone={severe ? 'danger' : 'warn'}>{REASON_LABELS[report.reason]}</Chip>
          {report.reportCount > 1 && <Chip>{`Reported ${report.reportCount} times`}</Chip>}
          <span className="small muted">{report.targetType === 'thread' ? 'Question' : 'Reply'}</span>
        </div>
        <time className="small muted" dateTime={report.createdAt}>
          {timeAgo(report.createdAt)}
        </time>
      </div>
      <blockquote className={styles.excerpt} style={{ margin: 0 }}>
        {report.targetExcerpt}
      </blockquote>
      <div className={styles.meta}>
        <span>
          By <strong>{report.targetAuthor.displayName}</strong>
          {report.targetAuthor.levelLabel ? ` · ${report.targetAuthor.levelLabel}` : ''}
        </span>
        <span>Reported by {report.reportedBy}</span>
        {report.threadId && <Link to={`/community/t/${report.threadId}`}>View in thread</Link>}
      </div>
      {report.note && <p className="small">“{report.note}”</p>}
      {report.status === 'open' ? (
        <div className={styles.actions}>
          {(Object.keys(ACTION_COPY) as ReportAction[]).map((a) => (
            <Button
              key={a}
              size="sm"
              variant={ACTION_COPY[a].variant}
              onClick={() => onAct(a)}
              disabled={a === 'suspend_user' && report.targetAuthor.role !== 'student'}
              title={
                a === 'suspend_user' && report.targetAuthor.role !== 'student'
                  ? 'Staff and teachers can only be changed by an admin on the People page'
                  : undefined
              }
            >
              {ACTION_COPY[a].label}
            </Button>
          ))}
        </div>
      ) : (
        report.resolution && (
          <Notice icon="check" className="small">
            {report.resolution}
          </Notice>
        )
      )}
    </li>
  );
}

export default function ReportsPage() {
  useDocumentTitle('Reports');
  const [status, setStatus] = useState<ReportStatus>('open');
  const reports = useReports(status);
  const resolve = useResolveReport();
  const [pending, setPending] = useState<{ report: Report; action: ReportAction } | null>(null);
  const [note, setNote] = useState('');

  const close = () => {
    setPending(null);
    setNote('');
  };

  const confirm = () => {
    if (!pending) return;
    const { report, action } = pending;
    resolve.mutate(
      { id: report.id, action, note: note.trim() },
      {
        onSuccess: () => toast(ACTION_COPY[action].done),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );
    close();
  };

  const items = reports.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Posts learners flagged. Personal information and bullying come first."
      />
      <Segmented label="Report status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      {reports.isPending ? (
        <div className="stack">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={170} />
          ))}
        </div>
      ) : reports.isError ? (
        <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="check" title={status === 'open' ? 'The queue is clear' : `No ${status} reports`}>
          {status === 'open'
            ? 'Ayekoo! Nothing needs a moderator right now.'
            : 'Handled reports will appear here.'}
        </EmptyState>
      ) : (
        <>
          <p className="small muted">
            {plural(reports.data.total, 'post')} {status === 'open' ? 'waiting for review' : status}
          </p>
          <ul className={styles.queue}>
            {[...items]
              .sort((a, b) => Number(SEVERE.has(b.reason)) - Number(SEVERE.has(a.reason)))
              .map((r) => (
                <ReportItem key={r.id} report={r} onAct={(action) => setPending({ report: r, action })} />
              ))}
          </ul>
        </>
      )}

      <Dialog open={!!pending} onClose={close} title={pending ? ACTION_COPY[pending.action].title : ''}>
        {pending && (
          <div className="stack">
            <p>{ACTION_COPY[pending.action].body}</p>
            <blockquote className={styles.excerpt} style={{ margin: 0 }}>
              {pending.report.targetExcerpt}
            </blockquote>
            <TextArea
              label="Note for the record (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant={
                  pending.action === 'dismiss' || pending.action === 'warn_user' ? 'primary' : 'danger'
                }
                onClick={confirm}
              >
                {ACTION_COPY[pending.action].label}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
