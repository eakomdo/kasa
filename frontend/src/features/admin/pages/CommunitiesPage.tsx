import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useUser } from '@/features/auth/session';
import { KIND_LABELS } from '@/features/community/api';
import { RoleChip } from '@/features/community/components/Author';
import { CommunityEmblem, PolicyChip } from '@/features/community/components/CommunityBits';
import type { Community } from '@/shared/api/schemas';
import { LANGUAGES } from '@/shared/config/languages';
import { BANDS } from '@/shared/config/levels';
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
  TextArea,
  errorMessage,
  toast,
} from '@/shared/ui';
import { useAdminCommunities, useCommunityDecision, type CommunityStatus } from '../api';
import styles from '../admin.module.css';

const STATUS_OPTIONS: Array<{ value: CommunityStatus; label: string }> = [
  { value: 'pending', label: 'Waiting' },
  { value: 'active', label: 'Live' },
  { value: 'rejected', label: 'Not approved' },
  { value: 'archived', label: 'Archived' },
];

const EMPTY: Record<CommunityStatus, { title: string; body: string }> = {
  pending: {
    title: 'No communities waiting',
    body: 'New proposals from learners and teachers show up here for review.',
  },
  active: { title: 'No live communities', body: 'Approved communities appear here.' },
  rejected: {
    title: 'Nothing rejected',
    body: 'Communities you don’t approve are kept here with the reason you gave.',
  },
  archived: {
    title: 'Nothing archived',
    body: 'Archived communities stay readable but take no new posts or members.',
  },
};

export default function CommunitiesPage() {
  useDocumentTitle('Communities');
  const [status, setStatus] = useState<CommunityStatus>('pending');
  const list = useAdminCommunities(status);
  const decide = useCommunityDecision(status);
  const [rejecting, setRejecting] = useState<Community | null>(null);

  const approve = (c: Community) =>
    decide.mutate(
      { id: c.id, action: 'approve' },
      {
        onSuccess: () => toast(`${c.name} is live. We told ${c.createdBy.displayName}.`),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );
  const archive = (c: Community) =>
    decide.mutate(
      { id: c.id, action: 'archive' },
      { onSuccess: () => toast(`${c.name} archived.`), onError: (e) => toast(errorMessage(e), 'error') },
    );

  return (
    <>
      <PageHeader
        title="Communities"
        subtitle="Check every new community before it goes live. Ask: is it for learning, is it safe for children, and is the name clear?"
      />
      <Segmented label="Show communities" options={STATUS_OPTIONS} value={status} onChange={setStatus} />

      {list.isPending ? (
        <div className="stack">
          {[0, 1].map((i) => (
            <Skeleton key={i} height={200} radius={14} />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState icon="community" title={EMPTY[status].title}>
          {EMPTY[status].body}
        </EmptyState>
      ) : (
        <>
          <p className="small muted">{plural(list.data.total, 'community', 'communities')}</p>
          <ul className={styles.queue}>
            {list.data.items.map((c) => (
              <CommunityItem
                key={c.id}
                community={c}
                busy={decide.isPending}
                onApprove={() => approve(c)}
                onReject={() => setRejecting(c)}
                onArchive={() => archive(c)}
              />
            ))}
          </ul>
        </>
      )}

      <RejectDialog
        community={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(note) =>
          rejecting &&
          decide.mutate(
            { id: rejecting.id, action: 'reject', note },
            {
              onSuccess: () => {
                toast(
                  `${rejecting.name} not approved. We sent your reason to ${rejecting.createdBy.displayName}.`,
                );
                setRejecting(null);
              },
              onError: (e) => toast(errorMessage(e), 'error'),
            },
          )
        }
        busy={decide.isPending}
      />
    </>
  );
}

function CommunityItem({
  community: c,
  busy,
  onApprove,
  onReject,
  onArchive,
}: {
  community: Community;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onArchive: () => void;
}) {
  const user = useUser();
  const bands = c.bands.length
    ? BANDS.filter((b) => c.bands.includes(b.id))
        .map((b) => b.name)
        .join(', ')
    : 'Every class';
  return (
    <li className={styles.item}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <CommunityEmblem community={c} size={48} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <div className="row-between">
            <h2 style={{ overflowWrap: 'anywhere' }}>{c.name}</h2>
            <time className="small muted" dateTime={c.createdAt}>
              {timeAgo(c.createdAt)}
            </time>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            <Chip>{c.official ? 'Official' : KIND_LABELS[c.kind]}</Chip>
            <PolicyChip policy={c.joinPolicy} />
            {c.lang && <Chip>{LANGUAGES[c.lang].name}</Chip>}
          </div>
        </div>
      </div>
      <p className={styles.excerpt}>{c.description}</p>
      <div className={styles.meta}>
        <span className="row" style={{ gap: 6 }}>
          Started by <strong>{c.createdBy.displayName}</strong>
          {c.createdBy.levelLabel && <span>({c.createdBy.levelLabel})</span>}
          <RoleChip role={c.createdBy.role} />
        </span>
        <span>{bands}</span>
        {c.school && <span>{c.school}</span>}
        {c.region && <span>{c.region}</span>}
        {c.status !== 'pending' && <span>{plural(c.memberCount, 'member')}</span>}
      </div>
      {c.status === 'pending' && c.createdBy.role === 'student' && (
        <p className="small muted">
          A student started this. If approved, they’ll be its owner with helper powers; removing posts stays
          with Kasa.
        </p>
      )}
      <div className={styles.actions}>
        {c.status === 'pending' && (
          <>
            <Button size="sm" icon="check" onClick={onApprove} disabled={busy}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={onReject} disabled={busy}>
              Don’t approve
            </Button>
          </>
        )}
        {c.status === 'active' && (!c.official || user.role === 'admin') && (
          <Button size="sm" variant="subtle" onClick={onArchive} disabled={busy}>
            Archive
          </Button>
        )}
        {c.status !== 'pending' && (
          <Link to={`/community/c/${c.slug}`} className="small" style={{ alignSelf: 'center' }}>
            Open community
          </Link>
        )}
      </div>
    </li>
  );
}

function RejectDialog({
  community,
  onClose,
  onConfirm,
  busy,
}: {
  community: Community | null;
  onClose: () => void;
  onConfirm: (note: string) => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 5) return setError('Tell the creator why, so they can fix it or try again.');
    onConfirm(note.trim());
    setNote('');
  };
  return (
    <Dialog open={!!community} onClose={onClose} title={`Don’t approve ${community?.name ?? ''}?`}>
      <form className="stack" onSubmit={submit} noValidate>
        <p className="small muted">
          {community?.createdBy.displayName} will see your reason. Keep it kind and specific.
        </p>
        <TextArea
          label="Reason"
          hint="For example: “Please add which school this class is for.”"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setError(undefined);
          }}
          maxLength={300}
          rows={3}
          error={error}
        />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Don’t approve
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
