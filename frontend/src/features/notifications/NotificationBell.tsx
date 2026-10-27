import { useCallback, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useDismiss, useIsDesktop } from '@/shared/lib/hooks';
import { Icon, Skeleton } from '@/shared/ui';
import { useMarkRead, useNotifications } from './api';
import { NotificationItem } from './NotificationItem';
import styles from './Notifications.module.css';
import buttonStyles from '@/shared/ui/Button.module.css';

/** Bell with unread count. Desktop opens a panel; phones go to /notifications. */
export function NotificationBell() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const unread = data?.unreadCount ?? 0;
  const label = unread ? `Notifications, ${unread} unread` : 'Notifications';

  useDismiss(wrap, open, close);

  const badge = unread > 0 && <span className={styles.count}>{unread > 9 ? '9+' : unread}</span>;

  if (!desktop) {
    return (
      <Link to="/notifications" className={`${buttonStyles.iconButton} ${styles.bell}`} aria-label={label}>
        <Icon name="bell" size={20} />
        {badge}
      </Link>
    );
  }

  return (
    <div ref={wrap} className={styles.bell}>
      <button
        type="button"
        className={buttonStyles.iconButton}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={20} />
      </button>
      {badge}
      {open && (
        <div id={panelId} className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.panelHead}>
            <h2>Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                className="small"
                style={linkButton}
                onClick={() => markRead.mutate(undefined)}
              >
                Mark all read
              </button>
            )}
          </div>
          {isLoading ? (
            <div style={{ padding: 16 }}>
              <Skeleton height={56} />
            </div>
          ) : data && data.items.length > 0 ? (
            <ul className={styles.list}>
              {data.items.slice(0, 8).map((n) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  onOpen={(x) => {
                    setOpen(false);
                    if (!x.read) markRead.mutate([x.id]);
                  }}
                />
              ))}
            </ul>
          ) : (
            <p className="small muted" style={{ padding: '8px 16px 20px' }}>
              You’re all caught up. Replies, join requests and approvals will show up here.
            </p>
          )}
          <div className={styles.panelFoot}>
            <Link to="/notifications" onClick={() => setOpen(false)}>
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

const linkButton = {
  background: 'none',
  border: 0,
  color: 'var(--accent)',
  fontWeight: 700,
  textDecoration: 'underline',
  padding: 4,
} as const;
