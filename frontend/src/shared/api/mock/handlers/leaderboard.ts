import type { Leaderboard, LeaderboardEntry } from '@/shared/api/schemas';
import { dayKey } from '@/shared/lib/date';
import { PEERS } from '../data/people';
import { route } from '../http';
import { weekStart, xpThisWeek } from './practice';

export const leaderboardRoutes = [
  route('GET', '/leaderboard/', (ctx): Leaderboard => {
    const user = ctx.requireUser({ allowSuspended: true });
    const scope =
      (['school', 'region', 'national'] as const).find((s) => s === ctx.query.get('scope')) ?? 'school';
    const lang = ctx.query.get('lang') === 'ga' ? 'ga' : 'twi';
    const label =
      scope === 'school'
        ? (user.school ?? 'Your school')
        : scope === 'region'
          ? `${user.region ?? 'Your'} Region`
          : 'All of Ghana';

    const inScope = PEERS.filter((p) => p.lang === lang && p.displayName !== user.displayName).filter((p) =>
      scope === 'school'
        ? user.school !== null && p.school === user.school
        : scope === 'region'
          ? user.region !== null && p.region === user.region
          : true,
    );
    const canRank = scope === 'national' || (scope === 'school' ? user.school : user.region);
    const rows = [
      ...inScope.map((p) => ({
        displayName: p.displayName,
        school: p.school,
        region: p.region,
        xp: p.xp,
        isMe: false,
      })),
      ...(canRank
        ? [
            {
              displayName: user.displayName,
              school: user.school,
              region: user.region,
              xp: xpThisWeek(ctx.db, user.id, ctx.now),
              isMe: true,
            },
          ]
        : []),
    ].sort((a, b) => b.xp - a.xp || Number(b.isMe) - Number(a.isMe));

    const entries: LeaderboardEntry[] = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    return {
      scope,
      label,
      weekStart: dayKey(weekStart(ctx.now)),
      entries: entries.slice(0, 20),
      me: entries.find((e) => e.isMe) ?? null,
    };
  }),
];
