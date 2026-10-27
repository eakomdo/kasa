import { useState } from 'react';
import type { ThreadSort, ThreadSummary } from '@/shared/api/schemas';
import { timeAgo } from '@/shared/lib/date';
import { useDebouncedValue } from '@/shared/lib/hooks';
import { plural } from '@/shared/lib/misc';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Icon,
  List,
  ListRow,
  Segmented,
  Skeleton,
  TextField,
} from '@/shared/ui';
import { useThreads } from '../api';
import styles from '../community.module.css';

const SORTS: Array<{ value: ThreadSort; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
  { value: 'unanswered', label: 'Unanswered' },
];

/** One discussion as a list row: title, then a single line of context. */
export function ThreadRow({ thread, showCommunity }: { thread: ThreadSummary; showCommunity?: boolean }) {
  const answeredByTeacher = thread.hasAcceptedAnswer;
  return (
    <ListRow
      to={`/community/t/${thread.id}`}
      title={
        <>
          {(thread.pinned || thread.locked) && (
            <span className={styles.statusIcons}>
              {thread.pinned && <Icon name="pin" size={15} aria-label="Pinned" role="img" />}
              {thread.locked && <Icon name="lock" size={15} aria-label="Closed" role="img" />}
            </span>
          )}
          {thread.title}
        </>
      }
      meta={
        <>
          {showCommunity ? `${thread.communityName} · ` : `${thread.author.displayName} · `}
          {answeredByTeacher ? (
            <span className={styles.answered}>Answered</span>
          ) : (
            plural(thread.replyCount, 'answer')
          )}
          {` · ${timeAgo(thread.lastActivityAt)}`}
        </>
      }
    />
  );
}

/**
 * Search, sort and paginated list of discussions. With a communityId it shows
 * that community; without, the hub feed from every community you've joined.
 */
export function ThreadFeed({ communityId, canAsk = true }: { communityId?: string; canAsk?: boolean }) {
  const [sort, setSort] = useState<ThreadSort>('active');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 350);
  const threads = useThreads({ communityId, sort, q: q || undefined });
  const items = threads.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="stack" aria-label="Discussions">
      <div className={styles.controls}>
        <TextField
          label="Search discussions"
          hideLabel
          type="search"
          placeholder="Search questions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          enterKeyHint="search"
        />
        <Segmented label="Sort discussions" options={SORTS} value={sort} onChange={setSort} />
      </div>

      {threads.isPending ? (
        <div className="stack-sm" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={56} />
          ))}
        </div>
      ) : threads.isError ? (
        <ErrorState error={threads.error} onRetry={() => void threads.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={q ? 'search' : 'community'}
          title={
            q
              ? `Nothing matches “${q}”`
              : sort === 'unanswered'
                ? 'Every question has an answer'
                : 'No discussions here yet'
          }
          action={
            canAsk && (
              <ButtonLink
                to={communityId ? `/community/ask?community=${communityId}` : '/community/ask'}
                size="sm"
                variant="ghost"
              >
                Ask a question
              </ButtonLink>
            )
          }
        >
          {q
            ? 'Try a shorter word, or ask it as a new question.'
            : communityId
              ? 'Be the first to start one. Someone else is probably wondering the same thing.'
              : 'Join a few communities and their newest discussions will show up here.'}
        </EmptyState>
      ) : (
        <>
          <List label="Discussions">
            {items.map((t) => (
              <ThreadRow key={t.id} thread={t} showCommunity={!communityId} />
            ))}
          </List>
          {threads.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              className={styles.loadMore}
              loading={threads.isFetchingNextPage}
              onClick={() => void threads.fetchNextPage()}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </section>
  );
}
