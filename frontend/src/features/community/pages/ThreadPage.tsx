import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useUser } from '@/features/auth/session';
import { ApiError } from '@/shared/api/client';
import type { Reply, ThreadDetail } from '@/shared/api/schemas';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { cn, plural } from '@/shared/lib/misc';
import {
  ButtonLink,
  Card,
  ErrorState,
  Icon,
  Notice,
  PageHeader,
  Skeleton,
  errorMessage,
  toast,
} from '@/shared/ui';
import {
  TAG_LABELS,
  useAccept,
  useCommunity,
  useModerateThread,
  useRemoveReply,
  useThread,
  useVote,
} from '../api';
import { AuthorLine, PostBody } from '../components/Author';
import { ReportDialog, VoteControl } from '../components/PostControls';
import { ReplyComposer } from '../components/ReplyComposer';
import { GuidelinesCard, JoinButton } from '../components/CommunityBits';
import styles from '../community.module.css';

type ReportTarget = { type: 'thread' | 'reply'; id: string } | null;

function ThreadSkeleton() {
  return (
    <div className="stack" aria-busy="true">
      <Skeleton height={36} width="80%" />
      <Skeleton height={16} width="40%" />
      <Skeleton height={120} />
      <Skeleton height={90} />
    </div>
  );
}

function ReplyItem({
  reply,
  thread,
  onReport,
}: {
  reply: Reply;
  thread: ThreadDetail;
  onReport: (t: ReportTarget) => void;
}) {
  const user = useUser();
  const vote = useVote(thread.id);
  const accept = useAccept(thread.id);
  const removeReply = useRemoveReply(thread.id);
  const own = reply.author.id === user.id;

  if (reply.status === 'removed') {
    return (
      <li className={cn(styles.reply, styles.removed)}>
        <span className="row">
          <Icon name="shield" size={18} /> Removed by a moderator because it broke the community rules.
        </span>
      </li>
    );
  }

  return (
    <li
      className={cn(styles.reply, reply.accepted && styles.accepted)}
      aria-label={reply.accepted ? 'Accepted answer' : undefined}
    >
      <span className={styles.acceptedLabel}>
        <Icon name="check" size={16} strokeWidth={2.6} /> Best answer
      </span>
      <AuthorLine author={reply.author} createdAt={reply.createdAt} />
      <PostBody text={reply.body} />
      <div className={styles.postActions}>
        <VoteControl
          label={`reply by ${reply.author.displayName}`}
          score={reply.score}
          myVote={reply.myVote}
          disabledReason={own ? 'You can’t vote on your own reply' : undefined}
          onVote={(value) =>
            vote.mutate(
              { kind: 'reply', id: reply.id, value },
              { onError: (e) => toast(errorMessage(e), 'error') },
            )
          }
        />
        {thread.canAccept && (
          <button
            type="button"
            className={styles.textAction}
            aria-pressed={reply.accepted}
            disabled={accept.isPending}
            onClick={() =>
              accept.mutate(reply.id, {
                onSuccess: () =>
                  toast(reply.accepted ? 'Accepted answer removed.' : 'Marked as the best answer.'),
                onError: (e) => toast(errorMessage(e), 'error'),
              })
            }
          >
            <Icon name="check" size={18} />
            {reply.accepted ? 'Accepted' : 'Mark as best answer'}
          </button>
        )}
        <span className={styles.spacer} />
        {thread.canRemove && (
          <button
            type="button"
            className={styles.textAction}
            disabled={removeReply.isPending}
            onClick={() =>
              removeReply.mutate(reply.id, {
                onSuccess: () => toast('Reply removed.'),
                onError: (e) => toast(errorMessage(e), 'error'),
              })
            }
          >
            <Icon name="close" size={18} />
            Remove
          </button>
        )}
        {!own && (
          <button
            type="button"
            className={styles.textAction}
            onClick={() => onReport({ type: 'reply', id: reply.id })}
          >
            <Icon name="flag" size={18} />
            Report
          </button>
        )}
      </div>
    </li>
  );
}

export default function ThreadPage() {
  const { threadId = '' } = useParams();
  const user = useUser();
  const thread = useThread(threadId);
  const community = useCommunity(thread.data?.communityId ?? '', !!thread.data);
  const vote = useVote(threadId);
  const moderate = useModerateThread(threadId);
  const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
  useDocumentTitle(thread.data?.title ?? 'Discussion');

  if (thread.isPending) return <ThreadSkeleton />;
  if (thread.isError) {
    const locked = thread.error instanceof ApiError && thread.error.status === 403;
    return (
      <>
        <PageHeader backTo="/community" title="Discussion" />
        {locked ? (
          <div className={styles.locked}>
            <Icon name="lock" size={32} />
            <h2>This discussion is for members</h2>
            <p>
              {thread.error.message} Ask your teacher for the class code, or find the community in Discover.
            </p>
            <ButtonLink to="/community/discover" size="sm">
              Find communities
            </ButtonLink>
          </div>
        ) : (
          <ErrorState error={thread.error} onRetry={() => void thread.refetch()} />
        )}
      </>
    );
  }

  const t = thread.data;
  const own = t.author.id === user.id;
  const communityHref = `/community/c/${t.communityId}`;
  const visibleReplies = t.replies.filter((r) => r.status === 'visible').length;

  const runModeration = (action: 'pin' | 'lock' | 'remove') =>
    moderate.mutate(action, {
      onSuccess: (next) =>
        toast(
          action === 'remove'
            ? 'Discussion removed.'
            : action === 'pin'
              ? next.pinned
                ? 'Pinned to the top of the community.'
                : 'Unpinned.'
              : next.locked
                ? 'Discussion closed to new replies.'
                : 'Discussion reopened.',
        ),
      onError: (e) => toast(errorMessage(e), 'error'),
    });

  return (
    <div className={styles.page}>
      <Link to={communityHref} className={styles.breadcrumb}>
        <Icon name="back" size={16} /> {t.communityName}
      </Link>
      <article className={styles.post} aria-labelledby="thread-title">
        <h1 id="thread-title">{t.title}</h1>
        <AuthorLine author={t.author} createdAt={t.createdAt} verb="asked" />
        {(t.pinned || t.locked || t.status === 'removed' || t.tags.length > 0) && (
          <p className="small muted">
            {[
              t.pinned ? 'Pinned' : null,
              t.locked ? 'Closed to new replies' : null,
              t.status === 'removed' ? 'Removed (only moderators can see it)' : null,
              ...t.tags.map((tag) => `#${TAG_LABELS[tag] ?? tag}`),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <PostBody text={t.body} />
        <div className={styles.postActions}>
          <VoteControl
            label="this question"
            score={t.score}
            myVote={t.myVote}
            disabledReason={own ? 'You can’t vote on your own question' : undefined}
            onVote={(value) =>
              vote.mutate(
                { kind: 'thread', id: t.id, value },
                { onError: (e) => toast(errorMessage(e), 'error') },
              )
            }
          />
          <span className={styles.spacer} />
          {t.canModerate && (
            <>
              <button
                type="button"
                className={styles.textAction}
                aria-pressed={t.pinned}
                onClick={() => runModeration('pin')}
              >
                <Icon name="pin" size={18} />
                {t.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                className={styles.textAction}
                aria-pressed={t.locked}
                onClick={() => runModeration('lock')}
              >
                <Icon name="lock" size={18} />
                {t.locked ? 'Reopen' : 'Close'}
              </button>
            </>
          )}
          {t.canRemove && t.status === 'visible' && (
            <button type="button" className={styles.textAction} onClick={() => runModeration('remove')}>
              <Icon name="close" size={18} />
              Remove
            </button>
          )}
          {!own && (
            <button
              type="button"
              className={styles.textAction}
              onClick={() => setReportTarget({ type: 'thread', id: t.id })}
            >
              <Icon name="flag" size={18} />
              Report
            </button>
          )}
        </div>
      </article>

      <section className="stack" aria-labelledby="answers-heading">
        <h2 id="answers-heading">
          {visibleReplies === 0 ? 'No answers yet' : plural(visibleReplies, 'answer')}
        </h2>
        {t.replies.length === 0 ? (
          <p className="muted">If you know the answer, share it below and explain how you know.</p>
        ) : (
          <ul className={styles.replies}>
            {t.replies.map((r) => (
              <ReplyItem key={r.id} reply={r} thread={t} onReport={setReportTarget} />
            ))}
          </ul>
        )}
      </section>

      <Card aria-labelledby="reply-heading">
        <h2 id="reply-heading">{own ? 'Reply to your question' : 'Answer this question'}</h2>
        {user.status === 'suspended' ? (
          <Notice tone="warn" title="Posting is paused on your account">
            A moderator paused your community posting. You can still read discussions and keep learning.
          </Notice>
        ) : community.data &&
          !community.data.permissions.canPost &&
          community.data.membership?.status !== 'member' ? (
          <div className="stack-sm">
            <Notice title={`Join ${t.communityName} to reply`}>
              Members can answer questions and vote. Anyone can read.
            </Notice>
            <JoinButton community={community.data} size="md" />
          </div>
        ) : t.locked && !t.canModerate ? (
          <Notice icon="lock" title="This discussion is closed">
            New replies are turned off. Start a new question if you still need help.
          </Notice>
        ) : (
          <ReplyComposer threadId={t.id} isQuestionAuthor={own} />
        )}
      </Card>
      <GuidelinesCard />
      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}
