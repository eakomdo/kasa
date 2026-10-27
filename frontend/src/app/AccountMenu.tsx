import { useCallback, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLogout } from '@/features/auth/api';
import { canModerate, useUser } from '@/features/auth/session';
import { useDismiss } from '@/shared/lib/hooks';
import { Avatar, Icon, type IconName } from '@/shared/ui';
import styles from './AppShell.module.css';

export function AccountMenu() {
  const user = useUser();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  useDismiss(wrap, open, close);

  const items: Array<{ to: string; label: string; icon: IconName }> = [
    { to: '/profile', label: 'Profile and progress', icon: 'user' },
    { to: '/leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
    ...(canModerate(user) ? [{ to: '/admin', label: 'Community admin', icon: 'shield' as IconName }] : []),
  ];

  return (
    <div ref={wrap} className={styles.menuWrap}>
      <button
        type="button"
        className={styles.accountButton}
        aria-expanded={open}
        aria-controls={id}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={user.name} size={34} />
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div id={id} className={styles.menu} role="menu">
          <div className={styles.menuHead}>
            <strong>{user.name}</strong>
            <span className="small muted">{user.email}</span>
          </div>
          {items.map((i) => (
            <Link key={i.to} to={i.to} role="menuitem" className={styles.menuItem} onClick={close}>
              <Icon name={i.icon} size={18} />
              {i.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => {
              close();
              logout.mutate();
            }}
          >
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
