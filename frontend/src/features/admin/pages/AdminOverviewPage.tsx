import { Link } from 'react-router';
import type { AdminOverview } from '@/shared/api/schemas';
import { getLanguage } from '@/shared/config/languages';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/misc';
import { ButtonLink, ErrorState, PageHeader, ProgressBar, Skeleton, Split, Column } from '@/shared/ui';
import { useAdminOverview } from '../api';
import styles from '../admin.module.css';

const fmt = (n: number) => n.toLocaleString('en-GH');
const shortDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Rounds up to a tidy axis maximum (10, 20, 25, 50, 100…). */
function niceMax(v: number): number {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  const steps = [1, 2, 2.5, 5, 10];
  return (steps.find((s) => s * pow >= v) ?? 10) * pow;
}

function SignupsChart({ data }: { data: AdminOverview['signupsByDay'] }) {
  const W = 640;
  const H = 230;
  const m = { top: 14, right: 8, bottom: 30, left: 40 };
  const innerW = W - m.left - m.right;
  const innerH = H - m.top - m.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.count)));
  const ticks = [0, max / 2, max];
  const slot = innerW / data.length;
  const barW = Math.min(30, slot * 0.66);
  const y = (v: number) => m.top + innerH - (v / max) * innerH;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className={styles.chartWrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.chart}
        role="img"
        aria-label={`New sign-ups per day for the last 14 days, ${fmt(total)} in total. Highest day: ${Math.max(...data.map((d) => d.count))}.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text
              x={m.left - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={12}
              fill="var(--muted)"
            >
              {fmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = m.left + i * slot + (slot - barW) / 2;
          const last = i === data.length - 1;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y(d.count)}
                width={barW}
                height={Math.max(0, y(0) - y(d.count))}
                rx={4}
                fill={last ? 'var(--accent)' : 'var(--accent)'}
              >
                <title>{`${shortDate(d.date)}: ${d.count} sign-ups`}</title>
              </rect>
              {(i % 2 === 1 || last) && (
                <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--muted)">
                  {last ? 'Today' : shortDate(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="stack" aria-busy="true">
      <div className={styles.tiles}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={86} />
        ))}
      </div>
      <Skeleton height={240} />
    </div>
  );
}

export default function AdminOverviewPage() {
  useDocumentTitle('Admin overview');
  const overview = useAdminOverview();

  return (
    <>
      <PageHeader title="Overview" subtitle="How learners are doing and what needs a moderator today." />
      {overview.isPending ? (
        <OverviewSkeleton />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <OverviewBody data={overview.data} />
      )}
    </>
  );
}

function OverviewBody({ data }: { data: AdminOverview }) {
  const { stats } = data;
  const langTotal = data.languageSplit.reduce((s, l) => s + l.learners, 0) || 1;
  const tiles: Array<{ label: string; value: number; to?: string; alert?: boolean }> = [
    { label: 'Open reports', value: stats.openReports, to: '/admin/reports', alert: stats.openReports > 0 },
    {
      label: 'New communities waiting',
      value: stats.pendingCommunities,
      to: '/admin/communities',
      alert: stats.pendingCommunities > 0,
    },
    { label: 'Translations to review', value: stats.pendingSuggestions, to: '/admin/suggestions' },
    { label: 'Active communities', value: stats.activeCommunities, to: '/community/discover' },
    { label: 'Posts today', value: stats.postsToday, to: '/community' },
    { label: 'Active learners, 7 days', value: stats.activeLearners7d },
    { label: 'New sign-ups, 7 days', value: stats.newSignups7d },
    { label: 'Verified teachers', value: stats.verifiedTeachers, to: '/admin/users' },
  ];

  return (
    <>
      <div className={styles.tiles}>
        {tiles.map((t) => {
          const inner = (
            <>
              <b>{fmt(t.value)}</b>
              <span className={styles.tileLabel}>{t.label}</span>
            </>
          );
          return t.to ? (
            <Link key={t.label} to={t.to} className={cn(styles.tile, t.alert && styles.alert)}>
              {inner}
            </Link>
          ) : (
            <div key={t.label} className={styles.tile}>
              {inner}
            </div>
          );
        })}
      </div>

      <Split>
        <Column>
          <section className={styles.panel}>
            <div className="row-between">
              <h2>New sign-ups</h2>
              <span className="small muted">Last 14 days</span>
            </div>
            <SignupsChart data={data.signupsByDay} />
          </section>
          <section className={styles.panel}>
            <h2>Learners by language</h2>
            <div className={styles.splitRows}>
              {data.languageSplit.map((l) => (
                <div key={l.lang} className={styles.splitRow}>
                  <span>{getLanguage(l.lang).fullName}</span>
                  <ProgressBar
                    value={l.learners / langTotal}
                    label={`${getLanguage(l.lang).fullName} learners`}
                  />
                  <b>{fmt(l.learners)}</b>
                </div>
              ))}
            </div>
          </section>
        </Column>
        <Column>
          <section className={styles.panel}>
            <h2>Top regions</h2>
            <ol className={styles.regionList}>
              {data.topRegions.map((r) => (
                <li key={r.region}>
                  <span>{r.region}</span>
                  <b>{fmt(r.learners)}</b>
                </li>
              ))}
            </ol>
          </section>
          <section className={styles.panel}>
            <h2>Daily routine</h2>
            <p className="small muted">
              Clear the report queue first, then review new communities and translations. Reports about
              personal information or meeting up come first.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <ButtonLink to="/admin/reports" size="sm" icon="flag">
                Review reports
              </ButtonLink>
              <ButtonLink to="/admin/communities" size="sm" variant="ghost" icon="community">
                Review communities
              </ButtonLink>
              <ButtonLink to="/admin/suggestions" size="sm" variant="ghost" icon="translate">
                Review translations
              </ButtonLink>
            </div>
          </section>
        </Column>
      </Split>
    </>
  );
}
