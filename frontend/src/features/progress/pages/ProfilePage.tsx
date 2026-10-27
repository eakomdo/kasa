import { useInstallPrompt } from '@/app/pwa';
import { useLogout } from '@/features/auth/api';
import { canModerate, useUser } from '@/features/auth/session';
import type { BadgeId } from '@/shared/api/schemas';
import { getLanguage } from '@/shared/config/languages';
import { getLevel, levelLabel } from '@/shared/config/levels';
import { useDocumentTitle } from '@/shared/lib/hooks';
import {
  Avatar,
  ErrorState,
  Icon,
  IconLink,
  List,
  ListRow,
  Section,
  Skeleton,
  Stat,
  StatGrid,
} from '@/shared/ui';
import { BADGES, useProgressSummary } from '../api';
import { BadgeEmblem } from '../components/BadgeEmblem';
import styles from '../components/Progress.module.css';

/** "You": who you are, how you're doing, and the way to everything personal. */
export default function ProfilePage() {
  useDocumentTitle('You');
  const user = useUser();
  const language = getLanguage(user.lang);
  const summary = useProgressSummary();
  const logout = useLogout();
  const install = useInstallPrompt();
  const s = summary.data;

  const week = s?.history.slice(-7) ?? [];
  const max = Math.max(user.dailyGoal, ...week.map((d) => d.count));
  const earned = new Set(s?.badges.map((b) => b.id));

  return (
    <div className="stack" style={{ gap: 40, maxWidth: 'var(--reading-max)' }}>
      <header className={styles.identity}>
        <Avatar name={user.name} size={60} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>{user.name}</h1>
          <p className="small muted">
            {language.fullName} · {levelLabel(getLevel(user.levelId))}
            {user.school ? ` · ${user.school}` : ''}
          </p>
        </div>
        <IconLink to="/settings" icon="settings" label="Settings" />
      </header>

      {summary.error ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <>
          <StatGrid>
            <Stat value={s?.streak ?? '–'} label="day streak" />
            <Stat value={s?.learned ?? '–'} label="words learned" />
            <Stat value={s?.xpThisWeek ?? '–'} label="XP this week" />
          </StatGrid>

          <Section label="This week">
            {s ? (
              <div
                className={styles.week}
                role="img"
                aria-label={`Cards practised in the last 7 days: ${week.map((d) => d.count).join(', ')}`}
              >
                {week.map((d, i) => {
                  const dow = new Date(`${d.date}T12:00:00`).getDay();
                  return (
                    <div key={d.date} className={styles.day}>
                      <span>{d.count || ''}</span>
                      <i
                        data-zero={d.count === 0}
                        data-today={i === week.length - 1}
                        style={{ height: `${Math.max(4, (d.count / max) * 88)}px` }}
                      />
                      <span>{language.weekdays[dow]}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Skeleton height={132} />
            )}
          </Section>

          <Section label={`Badges · ${earned.size} of ${Object.keys(BADGES).length}`}>
            <ul className={styles.badges}>
              {(Object.keys(BADGES) as BadgeId[]).map((id) => (
                <li key={id} className={styles.badge} data-earned={earned.has(id)}>
                  <BadgeEmblem id={id} earned={earned.has(id)} />
                  <div>
                    <b>{BADGES[id].name}</b>
                    <span>{earned.has(id) ? 'Earned' : BADGES[id].description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      <List label="More">
        <ListRow
          to="/leaderboard"
          start={<Icon name="trophy" />}
          title="Leaderboard"
          end={<Icon name="chevronRight" size={18} />}
        />
        <ListRow
          to="/notifications"
          start={<Icon name="bell" />}
          title="Notifications"
          end={<Icon name="chevronRight" size={18} />}
        />
        <ListRow
          to="/settings"
          start={<Icon name="settings" />}
          title="Settings and Kasa Plus"
          end={<Icon name="chevronRight" size={18} />}
        />
        {canModerate(user) && (
          <ListRow
            to="/admin"
            start={<Icon name="shield" />}
            title="Community admin"
            end={<Icon name="chevronRight" size={18} />}
          />
        )}
        {install.canInstall && (
          <ListRow
            onClick={() => void install.install()}
            start={<Icon name="download" />}
            title="Install Kasa on this phone"
            meta="Opens like an app, works offline, uses less data"
          />
        )}
        <ListRow onClick={() => logout.mutate()} start={<Icon name="logout" />} title="Sign out" />
      </List>
    </div>
  );
}
