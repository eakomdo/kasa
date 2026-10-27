import { Link } from 'react-router';
import type { Notification, NotificationKind } from '@/shared/api/schemas';
import { timeAgo } from '@/shared/lib/date';
import { Icon, type IconName } from '@/shared/ui';
import styles from './Notifications.module.css';

const ICONS: Record<NotificationKind, IconName> = {
  join_request: 'users',
  join_approved: 'check',
  join_declined: 'info',
  community_approved: 'check',
  community_rejected: 'info',
  role_changed: 'shield',
  reply: 'community',
  answer_accepted: 'check',
  badge: 'trophy',
};

export function NotificationItem({ n, onOpen }: { n: Notification; onOpen: (n: Notification) => void }) {
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">
        <Icon name={ICONS[n.kind]} size={18} />
      </span>
      <span className={styles.text}>
        <strong>{n.title}</strong>
        <span>{n.body}</span>
        <span className={styles.time}>{timeAgo(n.createdAt)}</span>
      </span>
      {!n.read && <span className={styles.dot} aria-label="Unread" role="img" />}
    </>
  );
  return (
    <li>
      {n.href ? (
        <Link to={n.href} className={styles.item} data-unread={!n.read} onClick={() => onOpen(n)}>
          {content}
        </Link>
      ) : (
        <div className={styles.item} data-unread={!n.read}>
          {content}
        </div>
      )}
    </li>
  );
}
