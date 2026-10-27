import type {
  AdminOverview,
  AdminUser,
  Community,
  Report,
  ReportAction,
  Role,
  Suggestion,
} from '@/shared/api/schemas';
import { getLevel, levelLabel } from '@/shared/config/levels';
import { addDays, dayKey } from '@/shared/lib/date';
import type { Db, DbReport, DbSuggestion, DbUser } from '../db';
import { HttpError, paginate, route, str } from '../http';
import { notify } from '../notify';
import { excerptOf, serializeCommunity } from './community';
import { serializeAuthor } from './serializers';

/* ---------- Helpers ---------- */
function targetOf(db: Db, r: Pick<DbReport, 'targetType' | 'targetId'>) {
  if (r.targetType === 'thread') {
    const t = db.threads.find((x) => x.id === r.targetId);
    return t ? { authorId: t.authorId, threadId: t.id, text: `${t.title}: ${t.body}` } : null;
  }
  const rep = db.replies.find((x) => x.id === r.targetId);
  return rep ? { authorId: rep.authorId, threadId: rep.threadId, text: rep.body } : null;
}

const sameTarget = (a: DbReport, b: DbReport) => a.targetType === b.targetType && a.targetId === b.targetId;
const nameOf = (db: Db, userId: string) => db.users.find((u) => u.id === userId)?.displayName ?? 'A learner';

function serializeReport(db: Db, rep: DbReport, group: DbReport[]): Report {
  const target = targetOf(db, rep);
  return {
    id: rep.id,
    targetType: rep.targetType,
    targetId: rep.targetId,
    threadId: target?.threadId ?? '',
    targetExcerpt: target ? excerptOf(target.text, 240) : 'This post no longer exists.',
    targetAuthor: serializeAuthor(db, target?.authorId ?? 'unknown'),
    reason: rep.reason,
    note: rep.note,
    reportCount: group.length,
    reportedBy: nameOf(db, rep.reporterId),
    createdAt: rep.createdAt,
    status: rep.status,
    resolution: rep.resolution,
  };
}

/** One row per reported post per status, newest report first. */
function groupedReports(db: Db, status: DbReport['status']): Report[] {
  const rows = db.reports
    .filter((r) => r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seen: DbReport[] = [];
  const out: Report[] = [];
  for (const r of rows) {
    if (seen.some((s) => sameTarget(s, r))) continue;
    seen.push(r);
    out.push(
      serializeReport(
        db,
        r,
        rows.filter((x) => sameTarget(x, r)),
      ),
    );
  }
  return out;
}

const serializeSuggestion = (db: Db, s: DbSuggestion): Suggestion => {
  const { submittedById, ...rest } = s;
  return { ...rest, submittedBy: nameOf(db, submittedById) };
};

function reportsAgainst(db: Db, userId: string): number {
  return db.reports.filter((r) => targetOf(db, r)?.authorId === userId).length;
}

function serializeAdminUser(db: Db, u: DbUser): AdminUser {
  return {
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    status: u.status,
    levelLabel: levelLabel(getLevel(u.levelId)),
    lang: u.lang,
    region: u.region,
    school: u.school,
    createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt,
    reportsAgainst: reportsAgainst(db, u.id),
  };
}

/* Synthetic baseline so the preview dashboard looks like a live platform. */
const BASE_REGIONS: Record<string, number> = {
  Ashanti: 412,
  'Greater Accra': 365,
  Eastern: 164,
  Central: 141,
  Bono: 96,
  Western: 88,
  Volta: 61,
  Northern: 54,
};

const ACTIONS: ReportAction[] = ['dismiss', 'remove_content', 'warn_user', 'suspend_user'];
const ROLES: Role[] = ['student', 'teacher', 'moderator', 'admin'];

/* ---------- Routes ---------- */
export const adminRoutes = [
  route('GET', '/admin/overview/', (ctx): AdminOverview => {
    ctx.requireRole('moderator', 'admin');
    const { db, now } = ctx;
    const today = dayKey(now);
    const weekAgo = addDays(now, -7).toISOString();
    const signupsByDay = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(now, i - 13);
      const key = dayKey(d);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      const base = 14 + ((i * 7) % 11) + (weekend ? -6 : 3) + Math.floor(i / 2);
      return {
        date: key,
        count: base + db.users.filter((u) => dayKey(new Date(u.createdAt)) === key).length,
      };
    });
    const regionCounts = { ...BASE_REGIONS };
    for (const u of db.users) if (u.region) regionCounts[u.region] = (regionCounts[u.region] ?? 0) + 1;
    return {
      stats: {
        activeLearners7d: 1240 + db.users.filter((u) => u.lastActiveAt >= weekAgo).length,
        newSignups7d: signupsByDay.slice(-7).reduce((s, d) => s + d.count, 0),
        postsToday: [...db.threads, ...db.replies].filter((p) => dayKey(new Date(p.createdAt)) === today)
          .length,
        openReports: groupedReports(db, 'open').length,
        pendingSuggestions: db.suggestions.filter((s) => s.status === 'pending').length,
        verifiedTeachers: db.users.filter((u) => u.role === 'teacher').length,
        pendingCommunities: db.communities.filter((c) => c.status === 'pending').length,
        activeCommunities: db.communities.filter((c) => c.status === 'active').length,
      },
      signupsByDay,
      languageSplit: [
        { lang: 'twi', learners: 1012 + db.users.filter((u) => u.lang === 'twi').length },
        { lang: 'ga', learners: 236 + db.users.filter((u) => u.lang === 'ga').length },
      ],
      topRegions: Object.entries(regionCounts)
        .map(([region, learners]) => ({ region, learners }))
        .sort((a, b) => b.learners - a.learners)
        .slice(0, 6),
    };
  }),

  route('GET', '/admin/reports/', (ctx) => {
    ctx.requireRole('moderator', 'admin');
    const status =
      (['open', 'resolved', 'dismissed'] as const).find((s) => s === ctx.query.get('status')) ?? 'open';
    return paginate(groupedReports(ctx.db, status), ctx.query);
  }),

  route('POST', '/admin/reports/:reportId/resolve/', (ctx) => {
    const staff = ctx.requireRole('moderator', 'admin');
    const rep = ctx.db.reports.find((r) => r.id === ctx.params.reportId);
    if (!rep) throw new HttpError(404, 'That report doesn’t exist.');
    if (rep.status !== 'open') throw new HttpError(400, 'Another moderator already handled this report.');
    const action = ACTIONS.find((a) => a === ctx.body.action);
    if (!action) throw new HttpError(400, 'Choose what to do with this report.');
    const note = str(ctx.body, 'note', { max: 500, label: 'your note' });
    const target = targetOf(ctx.db, rep);

    let summary: string;
    switch (action) {
      case 'dismiss':
        summary = `Dismissed by ${staff.displayName}`;
        break;
      case 'remove_content': {
        const post =
          rep.targetType === 'thread'
            ? ctx.db.threads.find((t) => t.id === rep.targetId)
            : ctx.db.replies.find((r) => r.id === rep.targetId);
        if (post) post.status = 'removed';
        summary = `Post removed by ${staff.displayName}`;
        break;
      }
      case 'warn_user':
        summary = `${nameOf(ctx.db, target?.authorId ?? '')} was warned by ${staff.displayName}`;
        break;
      case 'suspend_user': {
        const author = ctx.db.users.find((u) => u.id === target?.authorId);
        if (!author) throw new HttpError(400, 'The author’s account no longer exists.');
        if (author.role !== 'student')
          throw new HttpError(
            400,
            'Teachers and staff can’t be suspended from the report queue. Ask an admin.',
          );
        author.status = 'suspended';
        const post =
          rep.targetType === 'thread'
            ? ctx.db.threads.find((t) => t.id === rep.targetId)
            : ctx.db.replies.find((r) => r.id === rep.targetId);
        if (post) post.status = 'removed';
        summary = `Post removed and ${author.displayName} suspended by ${staff.displayName}`;
        break;
      }
    }
    const resolution = note ? `${summary}: ${note}` : `${summary}.`;
    const group = ctx.db.reports.filter((r) => r.status === 'open' && sameTarget(r, rep));
    for (const r of group) {
      r.status = action === 'dismiss' ? 'dismissed' : 'resolved';
      r.resolution = resolution;
      r.action = action;
    }
    return serializeReport(ctx.db, rep, group);
  }),

  route('GET', '/admin/suggestions/', (ctx) => {
    ctx.requireRole('moderator', 'admin');
    const status =
      (['pending', 'approved', 'rejected'] as const).find((s) => s === ctx.query.get('status')) ?? 'pending';
    const rows = ctx.db.suggestions
      .filter((s) => s.status === status)
      .sort((a, b) => b.supporters - a.supporters || b.createdAt.localeCompare(a.createdAt))
      .map((s) => serializeSuggestion(ctx.db, s));
    return paginate(rows, ctx.query);
  }),

  route('POST', '/admin/suggestions/:suggestionId/review/', (ctx) => {
    ctx.requireRole('moderator', 'admin');
    const s = ctx.db.suggestions.find((x) => x.id === ctx.params.suggestionId);
    if (!s) throw new HttpError(404, 'That suggestion doesn’t exist.');
    if (s.status !== 'pending') throw new HttpError(400, 'This suggestion was already reviewed.');
    const decision = ctx.body.decision;
    if (decision !== 'approve' && decision !== 'reject')
      throw new HttpError(400, 'Choose approve or reject.');
    if (decision === 'approve') {
      const final =
        typeof ctx.body.finalTranslation === 'string' && ctx.body.finalTranslation.trim()
          ? str(ctx.body, 'finalTranslation', { max: 300, label: 'the translation' })
          : s.suggestion;
      const english = s.query.trim().toLowerCase();
      ctx.db.verifiedTranslations = ctx.db.verifiedTranslations.filter(
        (v) => !(v.lang === s.lang && v.english === english),
      );
      ctx.db.verifiedTranslations.push({ lang: s.lang, english, translation: final });
      s.suggestion = final;
      s.status = 'approved';
    } else {
      s.status = 'rejected';
    }
    return serializeSuggestion(ctx.db, s);
  }),

  route('GET', '/admin/users/', (ctx) => {
    ctx.requireRole('moderator', 'admin');
    const q = (ctx.query.get('q') ?? '').trim().toLowerCase();
    const role = ROLES.find((r) => r === ctx.query.get('role'));
    const status = ctx.query.get('status');
    const rows = ctx.db.users
      .filter((u) => !q || `${u.name} ${u.email} ${u.school ?? ''}`.toLowerCase().includes(q))
      .filter((u) => !role || u.role === role)
      .filter((u) => !status || u.status === status)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => serializeAdminUser(ctx.db, u));
    return paginate(rows, ctx.query);
  }),

  route('PATCH', '/admin/users/:userId/', (ctx) => {
    const staff = ctx.requireRole('moderator', 'admin');
    const target = ctx.db.users.find((u) => u.id === ctx.params.userId);
    if (!target) throw new HttpError(404, 'That account doesn’t exist.');
    if (target.id === staff.id) throw new HttpError(400, 'You can’t change your own account here.');
    const { role, status } = ctx.body;
    if (role !== undefined) {
      if (staff.role !== 'admin') throw new HttpError(403, 'Only admins can change roles.');
      const next = ROLES.find((r) => r === role);
      if (!next) throw new HttpError(400, 'Choose a valid role.');
      target.role = next;
    }
    if (status !== undefined) {
      if (status !== 'active' && status !== 'suspended')
        throw new HttpError(400, 'Status must be active or suspended.');
      if (target.role === 'admin') throw new HttpError(403, 'Admin accounts can’t be suspended.');
      target.status = status;
    }
    return serializeAdminUser(ctx.db, target);
  }),
  route('GET', '/admin/communities/', (ctx) => {
    const staff = ctx.requireRole('moderator', 'admin');
    const status =
      (['pending', 'active', 'rejected', 'archived'] as const).find((s) => s === ctx.query.get('status')) ??
      'pending';
    const rows: Community[] = ctx.db.communities
      .filter((c) => c.status === status)
      .sort((a, b) =>
        status === 'pending'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
      )
      .map((c) => serializeCommunity(ctx.db, c, staff));
    return paginate(rows, ctx.query);
  }),

  route('POST', '/admin/communities/:communityId/review/', (ctx) => {
    const staff = ctx.requireRole('moderator', 'admin');
    const c = ctx.db.communities.find((x) => x.id === ctx.params.communityId);
    if (!c) throw new HttpError(404, 'That community doesn’t exist.');
    if (c.status !== 'pending')
      throw new HttpError(400, 'Another moderator already reviewed this community.');
    const decision = ctx.body.decision;
    if (decision !== 'approve' && decision !== 'reject')
      throw new HttpError(400, 'Choose approve or reject.');
    if (decision === 'approve') {
      c.status = 'active';
      c.reviewNote = null;
      notify(
        ctx.db,
        c.createdById,
        {
          kind: 'community_approved',
          title: `${c.name} is live!`,
          body: 'A Kasa moderator approved your community. Share the code or link to invite people.',
          href: `/community/c/${c.slug}`,
        },
        ctx.now,
      );
    } else {
      const note = str(ctx.body, 'note', { min: 5, max: 300, label: 'a reason for the creator' });
      c.status = 'rejected';
      c.reviewNote = note;
      notify(
        ctx.db,
        c.createdById,
        {
          kind: 'community_rejected',
          title: `${c.name} wasn’t approved`,
          body: note,
          href: `/community/c/${c.slug}`,
        },
        ctx.now,
      );
    }
    c.reviewedById = staff.id;
    return serializeCommunity(ctx.db, c, staff);
  }),

  route('POST', '/admin/communities/:communityId/archive/', (ctx) => {
    const staff = ctx.requireRole('moderator', 'admin');
    const c = ctx.db.communities.find((x) => x.id === ctx.params.communityId);
    if (!c) throw new HttpError(404, 'That community doesn’t exist.');
    if (c.official && staff.role !== 'admin')
      throw new HttpError(403, 'Only admins can archive official communities.');
    if (c.status !== 'active') throw new HttpError(400, 'Only active communities can be archived.');
    c.status = 'archived';
    return serializeCommunity(ctx.db, c, staff);
  }),
];
