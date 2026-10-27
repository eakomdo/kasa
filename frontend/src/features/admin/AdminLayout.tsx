import { NavLink, Outlet } from 'react-router';
import { useUser } from '@/features/auth/session';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/misc';
import { Chip, Icon, IconLink, Logo, type IconName } from '@/shared/ui';
import { useAdminOverview } from './api';
import styles from './admin.module.css';

const NAV: Array<{
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  count?: 'reports' | 'suggestions' | 'communities';
}> = [
  { to: '/admin', label: 'Overview', icon: 'chart', end: true },
  { to: '/admin/reports', label: 'Reports', icon: 'flag', count: 'reports' },
  { to: '/admin/communities', label: 'Communities', icon: 'community', count: 'communities' },
  { to: '/admin/suggestions', label: 'Translations', icon: 'translate', count: 'suggestions' },
  { to: '/admin/users', label: 'People', icon: 'users' },
];

/** Moderation workspace. Lives outside the learner shell so staff always know where they are. */
export default function AdminLayout() {
  const user = useUser();
  const { data } = useAdminOverview();
  const countFor = (k?: 'reports' | 'suggestions' | 'communities') =>
    k === 'reports'
      ? data?.stats.openReports
      : k === 'suggestions'
        ? data?.stats.pendingSuggestions
        : k === 'communities'
          ? data?.stats.pendingCommunities
          : undefined;
  const roleLabel = user.role === 'admin' ? 'Admin' : 'Moderator';

  const link = (cls: string, activeCls: string) =>
    NAV.map((item) => {
      const count = countFor(item.count);
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => cn(cls, isActive && activeCls)}
        >
          <Icon name={item.icon} size={20} />
          {item.label}
          {!!count && (
            <span className={styles.badge} aria-label={`${count} waiting`}>
              {count}
            </span>
          )}
        </NavLink>
      );
    });

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Admin navigation">
        <div className={styles.sideBrand}>
          <Logo size={30} />
          <span>Community admin</span>
          <span>
            {user.displayName} · {roleLabel}
          </span>
        </div>
        <nav>
          <ul className={styles.sideNav}>
            {link(styles.sideLink!, styles.active!).map((el) => (
              <li key={el.key}>{el}</li>
            ))}
          </ul>
        </nav>
        <div className={styles.sideFoot}>
          {env.useMocks && (
            <Chip tone="warn" title="The preview uses sample learners and reports">
              Sample data
            </Chip>
          )}
          <NavLink to="/" className={styles.backLink}>
            <Icon name="back" size={18} />
            Back to Kasa
          </NavLink>
        </div>
      </aside>

      <header className={styles.topbar}>
        <div className={styles.topRow}>
          <IconLink to="/" icon="back" label="Back to Kasa" />
          <span className={styles.brand}>Kasa admin</span>
          {env.useMocks && <Chip tone="warn">Sample data</Chip>}
        </div>
        <nav className={styles.tabs} aria-label="Admin sections">
          {link(styles.tab!, styles.active!)}
        </nav>
      </header>

      <div className={styles.content}>
        <main className={styles.main} id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
