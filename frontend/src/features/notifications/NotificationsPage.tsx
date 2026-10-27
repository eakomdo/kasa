import { useDocumentTitle } from '@/shared/lib/hooks';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '@/shared/ui';
import { useMarkRead, useNotifications } from './api';
import { NotificationItem } from './NotificationItem';
import styles from './Notifications.module.css';

export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const { data, isLoading, error, refetch } = useNotifications();
  const markRead = useMarkRead();

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <PageHeader
        title="Notifications"
        actions={
          data && data.unreadCount > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => markRead.mutate(undefined)}>
              Mark all read
            </Button>
          ) : undefined
        }
      />
      {isLoading ? (
        <div className="stack-sm">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={64} radius={14} />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length > 0 ? (
        <ul className={`${styles.list} ${styles.pageList}`}>
          {data.items.map((n) => (
            <NotificationItem key={n.id} n={n} onOpen={(x) => !x.read && markRead.mutate([x.id])} />
          ))}
        </ul>
      ) : (
        <EmptyState icon="bell" title="You’re all caught up">
          When someone answers your question, approves your join request or reviews your community, you’ll see
          it here.
        </EmptyState>
      )}
    </div>
  );
}
