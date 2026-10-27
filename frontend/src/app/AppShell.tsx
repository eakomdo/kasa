import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NavLink, Outlet, ScrollRestoration, useLocation, useMatch, useNavigate } from 'react-router';
import { canModerate, useUser } from '@/features/auth/session';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { usePracticeOutbox } from '@/features/practice/outbox';
import { useProgressSummary } from '@/features/progress/api';
import { getLanguage } from '@/shared/config/languages';
import { getLevel, levelLabel } from '@/shared/config/levels';
import { useOnline } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/misc';
import { Button, Icon, Logo, type IconName } from '@/shared/ui';
import { AccountMenu } from './AccountMenu';
import { UpdatePrompt } from './UpdatePrompt';
import styles from './AppShell.module.css';

/** Four destinations on phones; desktop adds Lookup to the sidebar (search is always in the top bar). */
const TABS: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/', label: 'Today', icon: 'home', end: true },
  { to: '/learn', label: 'Learn', icon: 'units' },
  { to: '/community', label: 'Community', icon: 'community' },
  { to: '/profile', label: 'You', icon: 'user' },
];

const SIDEBAR: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/', label: 'Today', icon: 'home', end: true },
  { to: '/learn', label: 'Learn', icon: 'units' },
  { to: '/lookup', label: 'Lookup', icon: 'search' },
  { to: '/community', label: 'Community', icon: 'community' },
  { to: '/profile', label: 'You', icon: 'user' },
];

/** Moves focus to the new page's heading after navigation, so screen readers announce it. */
function useRouteFocus() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = requestAnimationFrame(() => {
      const h1 = document.querySelector<HTMLElement>('#main h1');
      if (h1) {
        h1.tabIndex = -1;
        h1.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);
}

function TopSearch() {
  const navigate = useNavigate();
  const user = useUser();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(`/lookup?q=${encodeURIComponent(q.trim())}`);
    setQ('');
  };
  return (
    <form role="search" className={styles.search} onSubmit={submit}>
      <Icon name="search" size={18} />
      <label htmlFor="top-search" className="visually-hidden">
        Look up a word
      </label>
      <input
        id="top-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Look up a word in English or ${getLanguage(user.lang).name}`}
        autoComplete="off"
      />
    </form>
  );
}

export function AppShell() {
  const user = useUser();
  const online = useOnline();
  const inSession = !!useMatch('/practice/session');
  const pending = usePracticeOutbox((s) => s.pending.length);
  const flush = usePracticeOutbox((s) => s.flush);
  const { data: summary } = useProgressSummary();
  const language = getLanguage(user.lang);
  useRouteFocus();

  const navClass = ({ isActive }: { isActive: boolean }) => cn(styles.sideLink, isActive && styles.active);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <ScrollRestoration />

      <aside className={styles.sidebar} aria-label="Main navigation">
        <NavLink to="/" className={styles.brand} aria-label="Kasa home">
          <Logo size={30} />
        </NavLink>
        <nav className={styles.sideNav}>
          <ul>
            {SIDEBAR.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={navClass}>
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              </li>
            ))}
            {canModerate(user) && (
              <li>
                <NavLink to="/admin" className={navClass}>
                  <Icon name="shield" />
                  Community admin
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
        <div className={styles.sideFoot}>
          <span className={styles.streak}>
            <Icon name="flame" size={16} />
            {summary?.streak ?? 0}-day streak
          </span>
          <span className="small muted">
            {language.fullName} · {levelLabel(getLevel(user.levelId))}
          </span>
        </div>
      </aside>

      <div className={styles.content}>
        {!inSession && (
          <header className={styles.topbar}>
            <TopSearch />
            <div className={styles.topActions}>
              <NotificationBell />
              <AccountMenu />
            </div>
          </header>
        )}
        <main className={cn(styles.main, inSession && styles.focus)} id="main">
          {!online && (
            <div className={styles.banner} role="status">
              <Icon name="cloudOff" size={18} />
              You’re offline. Saved units and practice still work
              {pending ? `; ${pending} answers will sync later` : ''}.
            </div>
          )}
          {online && pending > 0 && (
            <div className={styles.banner} role="status">
              <Icon name="info" size={18} />
              {pending} answers waiting to sync.
              <Button size="sm" variant="ghost" onClick={() => void flush()}>
                Sync now
              </Button>
            </div>
          )}
          {user.status === 'suspended' && (
            <div className={styles.banner} role="status">
              <Icon name="alert" size={18} />A moderator has paused your community posting. You can still
              learn and practise as usual.
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {!inSession && (
        <nav className={styles.tabbar} aria-label="Main navigation">
          <ul>
            {TABS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cn(styles.tab, isActive && styles.active)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <UpdatePrompt />
    </div>
  );
}
