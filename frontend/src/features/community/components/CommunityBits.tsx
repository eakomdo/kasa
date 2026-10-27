import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Community, CommunityRole } from '@/shared/api/schemas';
import { cn } from '@/shared/lib/misc';
import { checkPostSafety } from '@/shared/lib/safety';
import { communityMeta } from '../lib/communityMeta';
import { Button, Chip, Dialog, Icon, ListRow, TextArea, TextField, errorMessage, toast } from '@/shared/ui';
import {
  KIND_LABELS,
  POLICY_HINT,
  POLICY_LABELS,
  ROLE_LABELS,
  useJoinCommunity,
  useLeaveCommunity,
} from '../api';
import styles from '../community.module.css';

/** Coloured tile with the community's initials. */
export function CommunityEmblem({
  community,
  size = 44,
}: {
  community: Pick<Community, 'name' | 'color' | 'official'>;
  size?: number;
}) {
  const initials = community.name
    .split(/\s+/)
    .filter((w) => /[A-Za-zƐƆŊɛɔŋ]/.test(w[0] ?? ''))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={cn(styles.emblem, styles[`emblem_${community.color}`])}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials || 'K'}
      {community.official && (
        <span className={styles.emblemTick}>
          <Icon name="check" size={Math.max(10, size * 0.24)} strokeWidth={3.2} />
        </span>
      )}
    </span>
  );
}

export function PolicyChip({ policy }: { policy: Community['joinPolicy'] }) {
  return <Chip title={POLICY_HINT[policy]}>{POLICY_LABELS[policy]}</Chip>;
}

export function CommunityRoleChip({ role }: { role: CommunityRole | null }) {
  if (!role || role === 'member') return null;
  return <Chip>{ROLE_LABELS[role]}</Chip>;
}

export function StatusChip({ community }: { community: Community }) {
  if (community.status === 'pending') return <Chip tone="warn">Waiting for review</Chip>;
  if (community.status === 'rejected') return <Chip tone="danger">Not approved</Chip>;
  if (community.status === 'archived') return <Chip>Archived</Chip>;
  if (community.membership?.status === 'pending') return <Chip tone="warn">Request sent</Chip>;
  return null;
}

/** A community as a list row: emblem, name, one line of meta, optional action. */
export function CommunityRow({ community, action }: { community: Community; action?: ReactNode }) {
  return (
    <ListRow
      to={`/community/c/${community.slug}`}
      start={<CommunityEmblem community={community} size={40} />}
      title={community.name}
      meta={communityMeta(community)}
      end={action}
    />
  );
}

/** Preview card (used by the Create flow to show how the community will look). */
export function CommunityCard({
  community,
}: {
  community: Community;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={styles.communityCard}>
      <div className={styles.communityLink}>
        <CommunityEmblem community={community} size={48} />
        <span className={styles.communityText}>
          <span className={styles.communityName}>{community.name}</span>
          <span className={styles.communityMeta}>
            {KIND_LABELS[community.kind]} · {POLICY_LABELS[community.joinPolicy]}
            {community.school ? ` · ${community.school}` : ''}
          </span>
          <span className={styles.communityDesc}>{community.description}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The one button that adapts to membership and join policy:
 * Join · Request to join (with a note) · Enter class code · Requested (cancel).
 */
export function JoinButton({
  community,
  size = 'sm',
  block,
  primary,
}: {
  community: Community;
  size?: 'sm' | 'md';
  block?: boolean;
  /** The main action on the page (community header); lists use the quiet outline style. */
  primary?: boolean;
}) {
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const [dialog, setDialog] = useState<'request' | 'code' | null>(null);
  const m = community.membership;

  if (community.status !== 'active') return null;
  if (m?.status === 'member') return null;

  if (m?.status === 'pending') {
    return (
      <Button
        size={size}
        block={block}
        variant="ghost"
        loading={leave.isPending}
        onClick={() =>
          leave.mutate(community.id, {
            onSuccess: () => toast('Request cancelled.'),
            onError: (e) => toast(errorMessage(e), 'error'),
          })
        }
        aria-label={`Request sent to ${community.name}. Tap to cancel it.`}
      >
        Requested
      </Button>
    );
  }

  const joinOpen = () =>
    join.mutate(
      { community },
      {
        onSuccess: () => toast(`You joined ${community.name}.`),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );

  return (
    <>
      {community.joinPolicy === 'open' && (
        <Button
          size={size}
          block={block}
          variant={primary ? 'primary' : 'ghost'}
          loading={join.isPending}
          onClick={joinOpen}
        >
          Join
        </Button>
      )}
      {community.joinPolicy === 'request' && (
        <Button
          size={size}
          block={block}
          variant={primary ? 'primary' : 'ghost'}
          onClick={() => setDialog('request')}
        >
          Ask to join
        </Button>
      )}
      {community.joinPolicy === 'code' && (
        <Button
          size={size}
          block={block}
          variant={primary ? 'primary' : 'ghost'}
          onClick={() => setDialog('code')}
        >
          Enter code
        </Button>
      )}
      <RequestDialog community={community} open={dialog === 'request'} onClose={() => setDialog(null)} />
      <CodeDialog community={community} open={dialog === 'code'} onClose={() => setDialog(null)} />
    </>
  );
}

function RequestDialog({
  community,
  open,
  onClose,
}: {
  community: Community;
  open: boolean;
  onClose: () => void;
}) {
  const join = useJoinCommunity();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const safety = note.trim() ? checkPostSafety(note) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (safety) return;
    join.mutate(
      { community, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast('Request sent. You’ll get a notification when it’s answered.');
          setNote('');
          onClose();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Ask to join ${community.name}`}>
      <form className="stack" onSubmit={submit} noValidate>
        <p className="small muted">
          A helper or admin will look at your request. Telling them who you are makes it quicker.
        </p>
        <TextArea
          label="Note (optional)"
          hint="For example: “I’m in JHS 3 at Bantama and want to revise with you.”"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setError(undefined);
          }}
          maxLength={200}
          rows={3}
          error={safety ?? error}
        />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={join.isPending} disabled={!!safety}>
            Send request
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CodeDialog({
  community,
  open,
  onClose,
}: {
  community: Community;
  open: boolean;
  onClose: () => void;
}) {
  const join = useJoinCommunity();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setError('Type the class code your teacher gave you.');
    join.mutate(
      { community, code: code.trim() },
      {
        onSuccess: () => {
          toast(`You joined ${community.name}.`);
          setCode('');
          onClose();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Enter your class code">
      <form className="stack" onSubmit={submit} noValidate>
        <p className="small muted">Your teacher shares this code in class. It looks like ASF-7B.</p>
        <TextField
          label="Class code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(undefined);
          }}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          className={styles.codeInput}
          error={error}
        />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={join.isPending}>
            Join
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** One quiet line about safety, linking to the full rules. */
export function GuidelinesCard() {
  return (
    <p className={styles.footnote}>
      Be kind, explain your answers, and never share phone numbers or meet up. Moderators check reports every
      day. <Link to="/community/guidelines">Community rules</Link>
    </p>
  );
}
