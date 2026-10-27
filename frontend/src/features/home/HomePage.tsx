import { Link } from 'react-router';
import { useUser } from '@/features/auth/session';
import { useMyCommunities } from '@/features/community/api';
import { CommunityEmblem } from '@/features/community/components/CommunityBits';
import { unitTitle, useUnits } from '@/features/curriculum/api';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { useDailyFeature, useProgressSummary } from '@/features/progress/api';
import { getLanguage } from '@/shared/config/languages';
import { useDocumentTitle, useHour } from '@/shared/lib/hooks';
import { ButtonLink, Icon, IconLink, List, ListRow, Section, Skeleton } from '@/shared/ui';
import styles from './Home.module.css';

const partOfDay = (hour: number) =>
  hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

/**
 * "Today": one thing to do (today's review), then a short list of where to
 * continue. Everything else lives on its own screen.
 */
export default function HomePage() {
  useDocumentTitle('Today');
  const user = useUser();
  const hour = useHour();
  const language = getLanguage(user.lang);
  const { data: s } = useProgressSummary();
  const firstName = user.name.split(' ')[0] ?? user.name;

  const due = s?.dueCount ?? 0;
  const fresh = Math.min(user.dailyGoal, s?.newCount ?? 0);
  const big = due > 0 ? due : fresh;
  const bigLabel = due > 0 ? (due === 1 ? 'word due' : 'words due') : fresh > 0 ? 'new words' : 'all done';
  const minutes = Math.max(2, Math.round(user.dailyGoal / 2));

  return (
    <>
      <header className={`${styles.top} mobile-only`}>
        <Link to="/" className={styles.wordmark}>
          Kasa
        </Link>
        <div className={styles.topActions}>
          <span className={styles.streak} title="Day streak">
            <Icon name="flame" size={16} />
            {s?.streak ?? 0}
          </span>
          <IconLink to="/lookup" icon="search" label="Look up a word" />
          <NotificationBell />
        </div>
      </header>

      <div className={styles.layout}>
        <div className="stack" style={{ gap: 40 }}>
          <div className={styles.greeting}>
            <p className="eyebrow">{partOfDay(hour)}</p>
            <h1 lang={user.lang === 'twi' ? 'tw' : 'gaa'}>{language.greeting(firstName, hour)}</h1>
          </div>

          <section className={styles.today} aria-label="Today’s practice">
            <ProgressRing value={big} label={bigLabel} done={s?.todayCount ?? 0} goal={user.dailyGoal} />
            <ButtonLink to="/practice/session?mode=flashcard" className={styles.cta}>
              {big > 0 ? 'Begin today’s review' : 'Practise anyway'}
            </ButtonLink>
            <p className={styles.caption}>
              About {minutes} minutes · {s?.todayCount ?? 0} of {user.dailyGoal} cards today
            </p>
          </section>
        </div>

        <div className={styles.side}>
          <ContinueLearning />
          <YourCommunities />
          <Proverb />
        </div>
      </div>
    </>
  );
}

/** A ring that fills as today's cards are done; the number in the middle is what's left to do. */
function ProgressRing({
  value,
  label,
  done,
  goal,
}: {
  value: number;
  label: string;
  done: number;
  goal: number;
}) {
  const r = 80;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal ? done / goal : 0);
  return (
    <div
      className={styles.ring}
      role="img"
      aria-label={`${value} ${label}. ${done} of ${goal} cards done today.`}
    >
      <svg viewBox="0 0 176 176" aria-hidden="true">
        <circle cx="88" cy="88" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle
          cx="88"
          cy="88"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className={styles.ringLabel}>
        <b>{value > 0 ? value : <Icon name="check" size={40} />}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

function ContinueLearning() {
  const units = useUnits();
  const inProgress = (units.data ?? [])
    .filter((u) => u.progress.total > 0 && u.progress.learned / u.progress.total < 1)
    .slice(0, 2);
  return (
    <Section label="Continue learning" action={{ to: '/learn', label: 'All units' }}>
      {units.isLoading ? (
        <Skeleton height={120} />
      ) : (
        <List>
          {inProgress.map((u) => (
            <ListRow
              key={u.id}
              to={`/learn/${u.id}`}
              title={unitTitle(u)}
              titleLang={u.titleLocal ? (u.lang === 'twi' ? 'tw' : 'gaa') : undefined}
              meta={u.titleLocal ? u.titleEn : u.strand}
              end={`${Math.round((u.progress.learned / u.progress.total) * 100)}%`}
            />
          ))}
        </List>
      )}
    </Section>
  );
}

function YourCommunities() {
  const { data, isLoading } = useMyCommunities();
  const joined = data?.filter((c) => c.membership?.status === 'member').slice(0, 3) ?? [];
  if (!isLoading && joined.length === 0) {
    return (
      <Section label="Your communities">
        <p className="small muted">
          Join your class with a code from your teacher, or <Link to="/community">find a study group</Link>.
        </p>
      </Section>
    );
  }
  return (
    <Section label="Your communities" action={{ to: '/community', label: 'Open' }}>
      {isLoading ? (
        <Skeleton height={120} />
      ) : (
        <List>
          {joined.map((c) => (
            <ListRow
              key={c.id}
              to={`/community/c/${c.id}`}
              start={<CommunityEmblem community={c} size={36} />}
              title={c.name}
              meta={`${c.memberCount} members`}
            />
          ))}
        </List>
      )}
    </Section>
  );
}

function Proverb() {
  const { data } = useDailyFeature();
  const user = useUser();
  if (!data) return null;
  return (
    <aside className={styles.proverb} aria-label={data.kicker}>
      <p className="eyebrow">{data.kicker}</p>
      <p lang={user.lang === 'twi' ? 'tw' : 'gaa'}>{data.local}</p>
      <p>{data.english}</p>
    </aside>
  );
}
