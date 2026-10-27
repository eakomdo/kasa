import { useState } from 'react';
import { useUser } from '@/features/auth/session';
import type { LeaderboardScope } from '@/shared/api/schemas';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { formatShortDate } from '@/shared/lib/date';
import { ButtonLink, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/shared/ui';
import { useLeaderboard } from '../api';
import styles from '../components/Progress.module.css';

export default function LeaderboardPage() {
  useDocumentTitle('Leaderboard');
  const user = useUser();
  const [scope, setScope] = useState<LeaderboardScope>(
    user.school ? 'school' : user.region ? 'region' : 'national',
  );
  const board = useLeaderboard(scope);
  const missing = (scope === 'school' && !user.school) || (scope === 'region' && !user.region);

  return (
    <>
      <PageHeader
        title="Leaderboard"
        subtitle={
          board.data ? `${board.data.label} · week of ${formatShortDate(board.data.weekStart)}` : 'This week'
        }
        backTo="/profile"
      />
      <div className="stack" style={{ gap: 32, maxWidth: 'var(--reading-max)' }}>
        <Tabs
          label="Compare with"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'school', label: 'My school' },
            { value: 'region', label: 'My region' },
            { value: 'national', label: 'All of Ghana' },
          ]}
        />
        {missing ? (
          <EmptyState
            icon="trophy"
            title={scope === 'school' ? 'Add your school to compete' : 'Add your region to compete'}
            action={
              <ButtonLink to="/settings" size="sm">
                Open settings
              </ButtonLink>
            }
          >
            Only your first name and initial are shown to other learners.
          </EmptyState>
        ) : board.isLoading ? (
          <div className="stack-sm">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={60} radius={14} />
            ))}
          </div>
        ) : board.error ? (
          <ErrorState error={board.error} onRetry={() => void board.refetch()} />
        ) : (
          <ol className={styles.board}>
            {board.data?.entries.map((e) => (
              <li
                key={`${e.rank}-${e.displayName}`}
                className={styles.entry}
                data-me={e.isMe}
                aria-current={e.isMe ? 'true' : undefined}
              >
                <span className={styles.rank} data-medal={e.rank <= 3 ? e.rank : undefined}>
                  {e.rank}
                </span>
                <span className={styles.entryName}>
                  <strong>{e.isMe ? `${e.displayName} (you)` : e.displayName}</strong>
                  {scope !== 'school' && e.school && (
                    <span>{scope === 'national' ? `${e.school}, ${e.region}` : e.school}</span>
                  )}
                </span>
                <span className={styles.xp}>{e.xp} XP</span>
              </li>
            ))}
          </ol>
        )}
        <p className="small muted">
          Every card earns XP: 10 for a right answer, 3 for trying. Leaderboards reset every Monday. Other
          learners only see your first name, the first letter of your surname and your school.
        </p>
      </div>
    </>
  );
}
