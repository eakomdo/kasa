/**
 * Communities, memberships and discussions. The permission model is
 * documented above the community schemas in schemas.ts; `access()` below is
 * its single implementation, and every route goes through it.
 */
import type {
  Community,
  CommunityDetail,
  CommunityMember,
  CommunityPermissions,
  CommunityRole,
  JoinPolicy,
  Reply,
  ReportReason,
  ThreadDetail,
  ThreadSummary,
} from '@/shared/api/schemas';
import { getLevel } from '@/shared/config/levels';
import { dayKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/misc';
import { checkPostSafety } from '@/shared/lib/safety';
import {
  isStaff,
  type Db,
  type DbCommunity,
  type DbMembership,
  type DbReply,
  type DbThread,
  type DbUser,
} from '../db';
import { HttpError, route, str, type Ctx } from '../http';
import { notify } from '../notify';
import { awardBadge } from './practice';
import { serializeAuthor } from './serializers';

export const PAGE_SIZE = 15;
export const DAILY_THREAD_LIMIT = 5;
export const DAILY_REPLY_LIMIT = 30;
export const MAX_PENDING_PROPOSALS = 3;
export const TAGS = [
  'twi',
  'ga',
  'bece',
  'wassce',
  'pronunciation',
  'grammar',
  'proverbs',
  'vocabulary',
] as const;
const REASONS: ReportReason[] = [
  'spam',
  'bullying',
  'inappropriate',
  'personal_info',
  'wrong_translation',
  'other',
];
const KINDS = ['school', 'class', 'study', 'interest'] as const;
const POLICIES: JoinPolicy[] = ['open', 'request', 'code'];
const BANDS = ['lp', 'up', 'jhs', 'shs'] as const;
const COLORS: DbCommunity['color'][] = ['forest', 'gold', 'clay', 'sky'];
const RANK: Record<CommunityRole, number> = { owner: 4, admin: 3, helper: 2, member: 1 };

/* ---------- Access ---------- */
export const isAdult = (u: DbUser) => u.role !== 'student';

export function membershipOf(db: Db, communityId: string, userId: string): DbMembership | undefined {
  return db.memberships.find((m) => m.communityId === communityId && m.userId === userId);
}

export interface Access {
  membership: DbMembership | undefined;
  isMember: boolean;
  role: CommunityRole | null;
  perms: CommunityPermissions;
  /** Students who own a community may appoint helpers but nothing above. */
  canAppointHelpers: boolean;
}

export function access(db: Db, c: DbCommunity, user: DbUser): Access {
  const staff = isStaff(user.role);
  const m = membershipOf(db, c.id, user.id);
  const isMember = m?.status === 'member';
  const role = isMember ? (m.role ?? 'member') : null;
  const rank = role ? RANK[role] : 0;
  const live = c.status === 'active';
  const visible = c.status === 'active' || c.status === 'archived';
  const canView =
    staff || (visible && (c.joinPolicy === 'open' || isMember)) || (!visible && c.createdById === user.id);
  const canManageMembers = staff || (rank >= RANK.admin && isAdult(user));
  return {
    membership: m,
    isMember,
    role,
    canAppointHelpers: canManageMembers || role === 'owner',
    perms: {
      canView,
      canPost:
        live &&
        user.status === 'active' &&
        (staff || (isMember && (!c.staffOnlyPosting || rank >= RANK.admin))),
      canManageRequests: staff || rank >= RANK.helper,
      canPin: staff || rank >= RANK.helper,
      canRemovePosts: staff || (rank >= RANK.admin && isAdult(user)),
      canManageMembers,
      canAppointAdmins: staff || (role === 'owner' && isAdult(user)),
      canEditSettings: staff || rank >= RANK.admin || role === 'owner',
      canLeave: !!m && role !== 'owner',
    },
  };
}

/** Members (not just readers) can reply and vote; staff can everywhere. */
const canParticipate = (c: DbCommunity, user: DbUser, a: Access) =>
  c.status === 'active' && user.status === 'active' && (isStaff(user.role) || a.isMember);

export function findCommunity(ctx: Ctx, idOrSlug: string, user: DbUser): DbCommunity {
  const c = ctx.db.communities.find((x) => x.id === idOrSlug || x.slug === idOrSlug);
  const hidden = c && (c.status === 'pending' || c.status === 'rejected');
  if (!c || (hidden && c.createdById !== user.id && !isStaff(user.role)))
    throw new HttpError(404, 'We couldn’t find that community. It may have been closed.');
  return c;
}

const managersOf = (db: Db, communityId: string) =>
  db.memberships.filter(
    (m) => m.communityId === communityId && m.status === 'member' && m.role && RANK[m.role] >= RANK.helper,
  );

/* ---------- Serializers ---------- */
export function serializeCommunity(db: Db, c: DbCommunity, user: DbUser): Community {
  const m = membershipOf(db, c.id, user.id);
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    kind: c.kind,
    official: c.official,
    lang: c.lang,
    bands: c.bands,
    joinPolicy: c.joinPolicy,
    status: c.status,
    color: c.color,
    school: c.school,
    region: c.region,
    memberCount: db.memberships.filter((x) => x.communityId === c.id && x.status === 'member').length,
    threadCount: db.threads.filter((t) => t.communityId === c.id && t.status === 'visible').length,
    staffOnlyPosting: c.staffOnlyPosting,
    createdBy: serializeAuthor(db, c.createdById),
    createdAt: c.createdAt,
    membership: m ? { status: m.status, role: m.status === 'member' ? (m.role ?? 'member') : null } : null,
  };
}

export function serializeDetail(db: Db, c: DbCommunity, user: DbUser): CommunityDetail {
  const a = access(db, c, user);
  const canSeeReview = c.createdById === user.id || isStaff(user.role);
  return {
    ...serializeCommunity(db, c, user),
    rules: c.rules,
    joinCode: a.perms.canManageRequests ? c.joinCode : null,
    pendingRequests: a.perms.canManageRequests
      ? db.memberships.filter((m) => m.communityId === c.id && m.status === 'pending').length
      : 0,
    reviewNote: canSeeReview ? c.reviewNote : null,
    permissions: a.perms,
  };
}

function serializeMember(db: Db, m: DbMembership): CommunityMember {
  return {
    user: serializeAuthor(db, m.userId),
    role: m.status === 'member' ? (m.role ?? 'member') : null,
    status: m.status,
    joinedAt: m.joinedAt,
    requestedAt: m.requestedAt,
    requestNote: m.requestNote,
  };
}

export function scoreOf(db: Db, kind: 'thread' | 'reply', id: string, base: number): number {
  const suffix = `:${kind}:${id}`;
  return Object.entries(db.votes).reduce((s, [k, v]) => (k.endsWith(suffix) ? s + v : s), base);
}

const myVoteOf = (db: Db, userId: string, kind: 'thread' | 'reply', id: string) =>
  db.votes[`${userId}:${kind}:${id}`] ?? 0;

export function excerptOf(body: string, max = 160): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

const communityName = (db: Db, id: string) => db.communities.find((c) => c.id === id)?.name ?? 'Community';

function serializeSummary(db: Db, t: DbThread, user: DbUser): ThreadSummary {
  const accepted = t.acceptedReplyId
    ? db.replies.find((r) => r.id === t.acceptedReplyId && r.status === 'visible')
    : undefined;
  return {
    id: t.id,
    communityId: t.communityId,
    communityName: communityName(db, t.communityId),
    title: t.title,
    excerpt: excerptOf(t.body),
    author: serializeAuthor(db, t.authorId),
    lang: t.lang,
    tags: t.tags,
    createdAt: t.createdAt,
    lastActivityAt: t.lastActivityAt,
    replyCount: db.replies.filter((r) => r.threadId === t.id && r.status === 'visible').length,
    score: scoreOf(db, 'thread', t.id, t.baseScore),
    myVote: myVoteOf(db, user.id, 'thread', t.id),
    hasAcceptedAnswer: !!accepted,
    pinned: t.pinned,
    locked: t.locked,
  };
}

function serializeReply(db: Db, r: DbReply, user: DbUser, acceptedId: string | null): Reply {
  const removed = r.status === 'removed';
  return {
    id: r.id,
    threadId: r.threadId,
    author: serializeAuthor(db, r.authorId),
    body: removed ? '' : r.body,
    createdAt: r.createdAt,
    score: scoreOf(db, 'reply', r.id, r.baseScore),
    myVote: myVoteOf(db, user.id, 'reply', r.id),
    accepted: r.id === acceptedId && !removed,
    status: r.status,
  };
}

const canAcceptIn = (t: DbThread, user: DbUser, a: Access) =>
  t.authorId === user.id || user.role === 'teacher' || a.perms.canRemovePosts;

function serializeThread(db: Db, t: DbThread, c: DbCommunity, user: DbUser): ThreadDetail {
  const a = access(db, c, user);
  const replies = db.replies
    .filter((r) => r.threadId === t.id)
    .map((r) => serializeReply(db, r, user, t.acceptedReplyId))
    .sort(
      (x, y) =>
        Number(y.accepted) - Number(x.accepted) ||
        y.score - x.score ||
        x.createdAt.localeCompare(y.createdAt),
    );
  return {
    ...serializeSummary(db, t, user),
    body: t.body,
    status: t.status,
    replies,
    canAccept: canAcceptIn(t, user, a),
    canModerate: a.perms.canPin,
    canRemove: a.perms.canRemovePosts,
  };
}

/* ---------- Validation helpers ---------- */
function assertSafe(text: string, field: string) {
  const problem = checkPostSafety(text);
  if (problem) throw new HttpError(400, { [field]: [problem] });
}

const postedToday = (items: Array<{ authorId: string; createdAt: string }>, userId: string, now: Date) =>
  items.filter((x) => x.authorId === userId && dayKey(new Date(x.createdAt)) === dayKey(now)).length;

function parseVote(value: unknown): -1 | 0 | 1 {
  if (value === -1 || value === 0 || value === 1) return value;
  throw new HttpError(400, 'Vote must be -1, 0 or 1.');
}

function slugify(db: Db, name: string, selfId?: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'community';
  let slug = base;
  for (let i = 2; db.communities.some((c) => c.slug === slug && c.id !== selfId); i++) slug = `${base}-${i}`;
  return slug;
}

/** Readable class code like "ASF-7B": three letters from the name, a digit and a letter. */
export function makeJoinCode(db: Db, name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  const head = (letters[0] ?? 'K') + letters.slice(1).replace(/[AEIOU]/g, '');
  const prefix = (head + 'KSA').slice(0, 3);
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 500; attempt++) {
    const code = `${prefix}-${Math.floor(Math.random() * 9) + 1}${ALPHA[Math.floor(Math.random() * ALPHA.length)]}`;
    if (!db.communities.some((c) => c.joinCode === code)) return code;
  }
  return `${prefix}-${createId().slice(0, 4).toUpperCase()}`;
}

const normCode = (code: unknown) => (typeof code === 'string' ? code.replace(/\s+/g, '').toUpperCase() : '');

interface CommunityFields {
  name: string;
  description: string;
  rules: string[];
}

function validateFields(ctx: Ctx, partial: boolean, selfId?: string): Partial<CommunityFields> {
  const out: Partial<CommunityFields> = {};
  const b = ctx.body;
  if (!partial || b.name !== undefined) {
    const name = str(b, 'name', { min: 4, max: 60, label: 'the community name' });
    assertSafe(name, 'name');
    if (ctx.db.communities.some((c) => c.id !== selfId && c.name.toLowerCase() === name.toLowerCase()))
      throw new HttpError(400, {
        name: ['A community with this name already exists. Try adding your school or town.'],
      });
    out.name = name;
  }
  if (!partial || b.description !== undefined) {
    const description = str(b, 'description', { min: 20, max: 400, label: 'the description' });
    assertSafe(description, 'description');
    out.description = description;
  }
  if (!partial || b.rules !== undefined) {
    const raw = Array.isArray(b.rules) ? b.rules : [];
    const rules = raw
      .filter((r): r is string => typeof r === 'string')
      .map((r) => r.trim())
      .filter(Boolean);
    if (rules.length > 6) throw new HttpError(400, { rules: ['Keep it to 6 rules or fewer.'] });
    for (const r of rules) {
      if (r.length > 140) throw new HttpError(400, { rules: ['Each rule can be at most 140 characters.'] });
      assertSafe(r, 'rules');
    }
    out.rules = rules;
  }
  return out;
}

const parseBands = (v: unknown) =>
  Array.isArray(v)
    ? [
        ...new Set(
          v.filter((x): x is DbCommunity['bands'][number] => (BANDS as readonly unknown[]).includes(x)),
        ),
      ]
    : [];

const parsePolicy = (v: unknown): JoinPolicy => {
  const p = POLICIES.find((x) => x === v);
  if (!p) throw new HttpError(400, { joinPolicy: ['Choose how people join.'] });
  return p;
};

/* ---------- Thread helpers ---------- */
function threadContext(ctx: Ctx, threadId: string, user: DbUser) {
  const t = ctx.db.threads.find((x) => x.id === threadId);
  if (!t) throw new HttpError(404, 'This discussion was removed or doesn’t exist.');
  const c = findCommunity(ctx, t.communityId, user);
  const a = access(ctx.db, c, user);
  if (!a.perms.canView) throw new HttpError(403, `Join ${c.name} to read its discussions.`);
  if (t.status === 'removed' && !a.perms.canRemovePosts)
    throw new HttpError(404, 'This discussion was removed or doesn’t exist.');
  return { t, c, a };
}

function findReply(ctx: Ctx, id: string): DbReply {
  const r = ctx.db.replies.find((x) => x.id === id);
  if (!r) throw new HttpError(404, 'That reply doesn’t exist any more.');
  return r;
}

function joinAsMember(db: Db, c: DbCommunity, user: DbUser, now: Date): DbMembership {
  const existing = membershipOf(db, c.id, user.id);
  if (existing) {
    if (existing.status === 'pending') {
      existing.status = 'member';
      existing.role = 'member';
      existing.joinedAt = now.toISOString();
    }
    return existing;
  }
  const m: DbMembership = {
    communityId: c.id,
    userId: user.id,
    role: 'member',
    status: 'member',
    joinedAt: now.toISOString(),
    requestedAt: null,
    requestNote: null,
  };
  db.memberships.push(m);
  return m;
}

const joinResult = (db: Db, c: DbCommunity, user: DbUser, m: DbMembership) => ({
  community: serializeCommunity(db, c, user),
  membership: { status: m.status, role: m.status === 'member' ? (m.role ?? 'member') : null },
});

function memberTarget(ctx: Ctx, c: DbCommunity): { target: DbMembership; targetUser: DbUser } {
  const target = membershipOf(ctx.db, c.id, ctx.params.userId!);
  const targetUser = ctx.db.users.find((u) => u.id === ctx.params.userId);
  if (!target || !targetUser) throw new HttpError(404, 'That person isn’t in this community.');
  return { target, targetUser };
}

/* ---------- Routes ---------- */
export const communityRoutes = [
  /* Communities */
  route('GET', '/communities/', (ctx): Community[] => {
    const user = ctx.requireUser({ allowSuspended: true });
    const scope = ctx.query.get('scope') ?? 'mine';
    const q = (ctx.query.get('q') ?? '').trim().toLowerCase();
    const lang = ctx.query.get('lang');
    const band = getLevel(user.levelId).band;
    const matches = (c: DbCommunity) =>
      !q || `${c.name} ${c.description} ${c.school ?? ''} ${c.region ?? ''}`.toLowerCase().includes(q);
    let rows: DbCommunity[];
    if (scope === 'created') {
      rows = ctx.db.communities
        .filter((c) => c.createdById === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (scope === 'discover') {
      rows = ctx.db.communities
        .filter((c) => c.status === 'active' && membershipOf(ctx.db, c.id, user.id)?.status !== 'member')
        .filter((c) => (lang === 'all' ? true : !c.lang || c.lang === (lang ?? user.lang)))
        .filter((c) => lang === 'all' || c.bands.length === 0 || c.bands.includes(band))
        .map((c) => ({ c, n: serializeCommunity(ctx.db, c, user).memberCount }))
        .sort((a, b) => Number(b.c.joinPolicy === 'open') - Number(a.c.joinPolicy === 'open') || b.n - a.n)
        .map((x) => x.c);
    } else {
      const mine = ctx.db.memberships.filter((m) => m.userId === user.id);
      rows = ctx.db.communities
        .filter(
          (c) =>
            (c.status === 'active' || c.status === 'archived') && mine.some((m) => m.communityId === c.id),
        )
        .sort((a, b) => {
          const ma = mine.find((m) => m.communityId === a.id)!;
          const mb = mine.find((m) => m.communityId === b.id)!;
          return (
            Number(ma.status === 'pending') - Number(mb.status === 'pending') ||
            Number(a.official) - Number(b.official) ||
            a.name.localeCompare(b.name)
          );
        });
    }
    return rows.filter(matches).map((c) => serializeCommunity(ctx.db, c, user));
  }),

  route('POST', '/communities/', (ctx): CommunityDetail => {
    const user = ctx.requireUser();
    const staff = isStaff(user.role);
    if (!staff) {
      const pending = ctx.db.communities.filter(
        (c) => c.createdById === user.id && c.status === 'pending',
      ).length;
      if (pending >= MAX_PENDING_PROPOSALS)
        throw new HttpError(
          429,
          `You already have ${MAX_PENDING_PROPOSALS} communities waiting for review. Wait for those first.`,
        );
    }
    const fields = validateFields(ctx, false) as CommunityFields;
    const kind = KINDS.find((k) => k === ctx.body.kind);
    if (!kind) throw new HttpError(400, { kind: ['Choose what kind of community this is.'] });
    const lang = ctx.body.lang === 'twi' || ctx.body.lang === 'ga' ? ctx.body.lang : null;
    const school =
      typeof ctx.body.school === 'string' && ctx.body.school.trim()
        ? str(ctx.body, 'school', { max: 80 })
        : null;
    const region =
      typeof ctx.body.region === 'string' && ctx.body.region.trim() ? ctx.body.region.trim() : null;
    const id = `c-${createId().slice(0, 8)}`;
    const c: DbCommunity = {
      id,
      slug: slugify(ctx.db, fields.name),
      ...fields,
      kind,
      official: false,
      lang,
      bands: parseBands(ctx.body.bands),
      joinPolicy: parsePolicy(ctx.body.joinPolicy),
      joinCode: makeJoinCode(ctx.db, fields.name),
      status: staff ? 'active' : 'pending',
      color: COLORS[ctx.db.communities.length % COLORS.length]!,
      school,
      region,
      staffOnlyPosting: false,
      createdById: user.id,
      createdAt: ctx.now.toISOString(),
      reviewNote: null,
      reviewedById: staff ? user.id : null,
    };
    ctx.db.communities.push(c);
    ctx.db.memberships.push({
      communityId: id,
      userId: user.id,
      role: 'owner',
      status: 'member',
      joinedAt: ctx.now.toISOString(),
      requestedAt: null,
      requestNote: null,
    });
    return serializeDetail(ctx.db, c, user);
  }),

  route('POST', '/communities/join-by-code/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const code = normCode(ctx.body.code);
    if (!code) throw new HttpError(400, { code: ['Type the class code your teacher gave you.'] });
    const c = ctx.db.communities.find((x) => x.status === 'active' && normCode(x.joinCode) === code);
    if (!c)
      throw new HttpError(404, 'We couldn’t find a community with that code. Check it with your teacher.');
    return joinResult(ctx.db, c, user, joinAsMember(ctx.db, c, user, ctx.now));
  }),

  route('GET', '/communities/:communityId/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    return serializeDetail(ctx.db, findCommunity(ctx, ctx.params.communityId!, user), user);
  }),

  route('PATCH', '/communities/:communityId/', (ctx) => {
    const user = ctx.requireUser();
    const c = findCommunity(ctx, ctx.params.communityId!, user);
    if (!access(ctx.db, c, user).perms.canEditSettings)
      throw new HttpError(403, 'Only the owner and admins can change this community’s settings.');
    if (c.official && !isStaff(user.role))
      throw new HttpError(403, 'Only the Kasa team can change official communities.');
    const fields = validateFields(ctx, true, c.id);
    if (fields.name) {
      c.name = fields.name;
      c.slug = slugify(ctx.db, fields.name, c.id);
    }
    if (fields.description) c.description = fields.description;
    if (fields.rules) c.rules = fields.rules;
    if (ctx.body.joinPolicy !== undefined) c.joinPolicy = parsePolicy(ctx.body.joinPolicy);
    if (ctx.body.bands !== undefined) c.bands = parseBands(ctx.body.bands);
    if (ctx.body.lang !== undefined)
      c.lang = ctx.body.lang === 'twi' || ctx.body.lang === 'ga' ? ctx.body.lang : null;
    return serializeDetail(ctx.db, c, user);
  }),

  route('POST', '/communities/:communityId/code/rotate/', (ctx) => {
    const user = ctx.requireUser();
    const c = findCommunity(ctx, ctx.params.communityId!, user);
    if (!access(ctx.db, c, user).perms.canEditSettings)
      throw new HttpError(403, 'Only the owner and admins can change the class code.');
    c.joinCode = makeJoinCode(ctx.db, c.name);
    return serializeDetail(ctx.db, c, user);
  }),

  route('POST', '/communities/:communityId/join/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const c = findCommunity(ctx, ctx.params.communityId!, user);
    if (c.status !== 'active') throw new HttpError(400, 'This community isn’t taking new members right now.');
    const existing = membershipOf(ctx.db, c.id, user.id);
    if (existing?.status === 'member') return joinResult(ctx.db, c, user, existing);
    if (c.joinPolicy === 'open' || isStaff(user.role))
      return joinResult(ctx.db, c, user, joinAsMember(ctx.db, c, user, ctx.now));
    if (c.joinPolicy === 'code') {
      if (normCode(ctx.body.code) !== normCode(c.joinCode))
        throw new HttpError(400, {
          code: ['That code doesn’t match. Check it with your teacher and try again.'],
        });
      return joinResult(ctx.db, c, user, joinAsMember(ctx.db, c, user, ctx.now));
    }
    if (existing?.status === 'pending') return joinResult(ctx.db, c, user, existing);
    const note = str(ctx.body, 'note', { max: 200, label: 'your note' });
    if (note) assertSafe(note, 'note');
    const m: DbMembership = {
      communityId: c.id,
      userId: user.id,
      role: null,
      status: 'pending',
      joinedAt: null,
      requestedAt: ctx.now.toISOString(),
      requestNote: note || null,
    };
    ctx.db.memberships.push(m);
    for (const mgr of managersOf(ctx.db, c.id))
      notify(
        ctx.db,
        mgr.userId,
        {
          kind: 'join_request',
          title: `${user.displayName} asked to join ${c.name}`,
          body: note ? `“${note}”` : 'Approve or decline the request.',
          href: `/community/c/${c.slug}/manage`,
        },
        ctx.now,
      );
    return joinResult(ctx.db, c, user, m);
  }),

  route('POST', '/communities/:communityId/leave/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const c = findCommunity(ctx, ctx.params.communityId!, user);
    const m = membershipOf(ctx.db, c.id, user.id);
    if (!m) return { ok: true };
    if (m.role === 'owner')
      throw new HttpError(
        400,
        'You own this community. Hand it to another teacher or Kasa staff member before you leave.',
      );
    ctx.db.memberships = ctx.db.memberships.filter((x) => x !== m);
    return { ok: true };
  }),

  route('GET', '/communities/:communityId/members/', (ctx): CommunityMember[] => {
    const user = ctx.requireUser({ allowSuspended: true });
    const c = findCommunity(ctx, ctx.params.communityId!, user);
    const a = access(ctx.db, c, user);
    const status = ctx.query.get('status') === 'pending' ? 'pending' : 'member';
    if (status === 'pending' && !a.perms.canManageRequests)
      throw new HttpError(403, 'Only helpers and admins can see join requests.');
    if (status === 'member' && !(a.isMember || isStaff(user.role)))
      throw new HttpError(403, `Join ${c.name} to see who’s in it.`);
    const q = (ctx.query.get('q') ?? '').trim().toLowerCase();
    return ctx.db.memberships
      .filter((m) => m.communityId === c.id && m.status === status)
      .map((m) => serializeMember(ctx.db, m))
      .filter((m) => !q || m.user.displayName.toLowerCase().includes(q))
      .sort(
        (x, y) =>
          (y.role ? RANK[y.role] : 0) - (x.role ? RANK[x.role] : 0) ||
          (x.requestedAt ?? '').localeCompare(y.requestedAt ?? '') ||
          x.user.displayName.localeCompare(y.user.displayName),
      );
  }),

  route('POST', '/communities/:communityId/requests/:userId/:decision/', (ctx) => {
    const user = ctx.requireUser();
    const c = findCommunity(ctx, ctx.params.communityId!, user);
    if (!access(ctx.db, c, user).perms.canManageRequests)
      throw new HttpError(403, 'Only helpers and admins can answer join requests.');
    const decision = ctx.params.decision;
    if (decision !== 'approve' && decision !== 'decline') throw new HttpError(404, 'Unknown action.');
    const m = membershipOf(ctx.db, c.id, ctx.params.userId!);
    if (!m || m.status !== 'pending') throw new HttpError(404, 'That request was already answered.');
    if (decision === 'approve') {
      m.status = 'member';
      m.role = 'member';
      m.joinedAt = ctx.now.toISOString();
      notify(
        ctx.db,
        m.userId,
        {
          kind: 'join_approved',
          title: `You’re in! Welcome to ${c.name}`,
          body: `Your request to join ${c.name} was approved.`,
          href: `/community/c/${c.slug}`,
        },
        ctx.now,
      );
    } else {
      ctx.db.memberships = ctx.db.memberships.filter((x) => x !== m);
      notify(
        ctx.db,
        m.userId,
        {
          kind: 'join_declined',
          title: `Your request to join ${c.name} wasn’t accepted`,
          body: 'You can still learn and ask questions in the open Kasa communities.',
          href: '/community/discover',
        },
        ctx.now,
      );
    }
    return { ok: true };
  }),

  route('PATCH', '/communities/:communityId/members/:userId/', (ctx) => {
    const user = ctx.requireUser();
    const c = findCommunity(ctx, ctx.params.communityId!, user);
    const a = access(ctx.db, c, user);
    const { target, targetUser } = memberTarget(ctx, c);
    const next = (['admin', 'helper', 'member'] as const).find((r) => r === ctx.body.role);
    if (!next) throw new HttpError(400, 'Choose admin, helper or member.');
    if (target.status !== 'member')
      throw new HttpError(400, 'Approve their request before giving them a role.');
    if (targetUser.id === user.id) throw new HttpError(400, 'You can’t change your own role.');
    if (target.role === 'owner') throw new HttpError(400, 'To change the owner, use “Transfer ownership”.');
    if (next === 'admin' || target.role === 'admin') {
      if (!a.perms.canAppointAdmins) throw new HttpError(403, 'Only the owner can appoint or remove admins.');
      if (next === 'admin' && !isAdult(targetUser))
        throw new HttpError(
          400,
          'Admins must be teachers or Kasa staff. You can make this student a helper instead.',
        );
    } else if (!a.canAppointHelpers) {
      throw new HttpError(403, 'Only the owner and admins can change roles.');
    }
    target.role = next;
    notify(
      ctx.db,
      targetUser.id,
      {
        kind: 'role_changed',
        title:
          next === 'member'
            ? `You’re now a member of ${c.name}`
            : `You’re now ${next === 'admin' ? 'an admin' : 'a helper'} in ${c.name}`,
        body:
          next === 'helper'
            ? 'Helpers approve join requests and pin important discussions.'
            : next === 'admin'
              ? 'Admins manage members, settings and posts.'
              : 'Your helper or admin role was removed.',
        href: `/community/c/${c.slug}`,
      },
      ctx.now,
    );
    return serializeMember(ctx.db, target);
  }),

  route('POST', '/communities/:communityId/members/:userId/remove/', (ctx) => {
    const user = ctx.requireUser();
    const c = findCommunity(ctx, ctx.params.communityId!, user);
    const a = access(ctx.db, c, user);
    if (!a.perms.canManageMembers)
      throw new HttpError(403, 'Only teachers and Kasa staff who run this community can remove members.');
    const { target, targetUser } = memberTarget(ctx, c);
    if (target.role === 'owner') throw new HttpError(400, 'The owner can’t be removed.');
    if (targetUser.id === user.id) throw new HttpError(400, 'Use “Leave community” to remove yourself.');
    if (target.role === 'admin' && !a.perms.canAppointAdmins)
      throw new HttpError(403, 'Only the owner can remove an admin.');
    ctx.db.memberships = ctx.db.memberships.filter((x) => x !== target);
    return { ok: true };
  }),

  route('POST', '/communities/:communityId/transfer/', (ctx) => {
    const user = ctx.requireUser();
    const c = findCommunity(ctx, ctx.params.communityId!, user);
    const a = access(ctx.db, c, user);
    if (a.role !== 'owner' && !isStaff(user.role))
      throw new HttpError(403, 'Only the owner can hand over this community.');
    const targetId = typeof ctx.body.userId === 'string' ? ctx.body.userId : '';
    const target = membershipOf(ctx.db, c.id, targetId);
    const targetUser = ctx.db.users.find((u) => u.id === targetId);
    if (!target || target.status !== 'member' || !targetUser)
      throw new HttpError(404, 'That person isn’t a member.');
    if (!isAdult(targetUser))
      throw new HttpError(400, 'Ownership can only go to a teacher or Kasa staff member of this community.');
    const owner = ctx.db.memberships.find((m) => m.communityId === c.id && m.role === 'owner');
    const ownerUser = owner && ctx.db.users.find((u) => u.id === owner.userId);
    if (owner && ownerUser) owner.role = isAdult(ownerUser) ? 'admin' : 'helper';
    target.role = 'owner';
    notify(
      ctx.db,
      targetUser.id,
      {
        kind: 'role_changed',
        title: `You now own ${c.name}`,
        body: 'You can manage its settings, members and admins.',
        href: `/community/c/${c.slug}/manage`,
      },
      ctx.now,
    );
    return serializeDetail(ctx.db, c, user);
  }),

  /* Discussions */
  route('GET', '/community/threads/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const communityId = ctx.query.get('communityId');
    const sort = ctx.query.get('sort') ?? 'active';
    const q = (ctx.query.get('q') ?? '').trim().toLowerCase();
    const lang = ctx.query.get('lang');
    const offset = Math.max(0, Number(ctx.query.get('cursor') ?? 0) || 0);

    let rows = ctx.db.threads.filter((t) => t.status === 'visible');
    if (communityId) {
      const c = findCommunity(ctx, communityId, user);
      if (!access(ctx.db, c, user).perms.canView)
        throw new HttpError(403, `Join ${c.name} to read its discussions.`);
      rows = rows.filter((t) => t.communityId === c.id);
    } else {
      const joined = new Set(
        ctx.db.memberships
          .filter((m) => m.userId === user.id && m.status === 'member')
          .map((m) => m.communityId),
      );
      rows = rows.filter((t) => joined.has(t.communityId));
    }
    if (lang) rows = rows.filter((t) => t.lang === lang || t.lang === null);
    if (q) rows = rows.filter((t) => `${t.title} ${t.body} ${t.tags.join(' ')}`.toLowerCase().includes(q));

    let items = rows.map((t) => serializeSummary(ctx.db, t, user));
    if (sort === 'unanswered') items = items.filter((t) => t.replyCount === 0);
    const byNew = (a: ThreadSummary, b: ThreadSummary) => b.createdAt.localeCompare(a.createdAt);
    items.sort((a, b) => {
      if (communityId && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === 'top') return b.score - a.score || byNew(a, b);
      if (sort === 'new' || sort === 'unanswered') return byNew(a, b);
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    });
    const page = items.slice(offset, offset + PAGE_SIZE);
    return { items: page, nextCursor: offset + PAGE_SIZE < items.length ? String(offset + PAGE_SIZE) : null };
  }),

  route('POST', '/community/threads/', (ctx) => {
    const user = ctx.requireUser();
    const communityId = typeof ctx.body.communityId === 'string' ? ctx.body.communityId : '';
    if (!communityId) throw new HttpError(400, { communityId: ['Choose a community to ask in.'] });
    const c = findCommunity(ctx, communityId, user);
    const a = access(ctx.db, c, user);
    if (!a.perms.canPost) {
      if (c.status !== 'active') throw new HttpError(403, 'This community isn’t open for new posts.');
      if (!a.isMember && !isStaff(user.role)) throw new HttpError(403, `Join ${c.name} to post in it.`);
      throw new HttpError(403, `Only ${c.name}’s admins can start discussions here.`);
    }
    const title = str(ctx.body, 'title', { min: 8, max: 120, label: 'your title' });
    const body = str(ctx.body, 'body', { min: 10, max: 4000, label: 'your question' });
    assertSafe(title, 'title');
    assertSafe(body, 'body');
    if (postedToday(ctx.db.threads, user.id, ctx.now) >= DAILY_THREAD_LIMIT)
      throw new HttpError(
        429,
        `You can start ${DAILY_THREAD_LIMIT} discussions a day. Try again tomorrow, or add to an existing one.`,
      );
    const rawTags = Array.isArray(ctx.body.tags) ? ctx.body.tags : [];
    const tags = [
      ...new Set(rawTags.filter((t): t is string => (TAGS as readonly string[]).includes(t as string))),
    ].slice(0, 4);
    const thread: DbThread = {
      id: `t-${createId()}`,
      communityId: c.id,
      title,
      body,
      authorId: user.id,
      lang: c.lang,
      tags,
      createdAt: ctx.now.toISOString(),
      lastActivityAt: ctx.now.toISOString(),
      pinned: false,
      locked: false,
      status: 'visible',
      acceptedReplyId: null,
      baseScore: 0,
    };
    ctx.db.threads.unshift(thread);
    return serializeThread(ctx.db, thread, c, user);
  }),

  route('GET', '/community/threads/:threadId/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const { t, c } = threadContext(ctx, ctx.params.threadId!, user);
    return serializeThread(ctx.db, t, c, user);
  }),

  route('POST', '/community/threads/:threadId/replies/', (ctx) => {
    const user = ctx.requireUser();
    const { t, c, a } = threadContext(ctx, ctx.params.threadId!, user);
    if (!canParticipate(c, user, a)) throw new HttpError(403, `Join ${c.name} to reply.`);
    if (t.locked && !a.perms.canPin)
      throw new HttpError(403, 'This discussion is closed, so new replies are turned off.');
    const body = str(ctx.body, 'body', { min: 2, max: 2000, label: 'your reply' });
    assertSafe(body, 'body');
    if (postedToday(ctx.db.replies, user.id, ctx.now) >= DAILY_REPLY_LIMIT)
      throw new HttpError(
        429,
        `You’ve posted ${DAILY_REPLY_LIMIT} replies today. Great effort! You can reply again tomorrow.`,
      );
    const reply: DbReply = {
      id: `r-${createId()}`,
      threadId: t.id,
      authorId: user.id,
      body,
      createdAt: ctx.now.toISOString(),
      status: 'visible',
      baseScore: 0,
    };
    ctx.db.replies.push(reply);
    t.lastActivityAt = reply.createdAt;
    if (t.authorId !== user.id)
      notify(
        ctx.db,
        t.authorId,
        {
          kind: 'reply',
          title: `${user.displayName} replied to your question`,
          body: `“${excerptOf(t.title, 80)}” in ${c.name}`,
          href: `/community/t/${t.id}`,
        },
        ctx.now,
      );
    return serializeReply(ctx.db, reply, user, t.acceptedReplyId);
  }),

  route('POST', '/community/threads/:threadId/vote/', (ctx) => {
    const user = ctx.requireUser();
    const { t, c, a } = threadContext(ctx, ctx.params.threadId!, user);
    if (!canParticipate(c, user, a)) throw new HttpError(403, `Join ${c.name} to vote.`);
    if (t.authorId === user.id) throw new HttpError(400, 'You can’t vote on your own post.');
    const value = parseVote(ctx.body.value);
    ctx.db.votes[`${user.id}:thread:${t.id}`] = value;
    return { score: scoreOf(ctx.db, 'thread', t.id, t.baseScore), myVote: value };
  }),

  route('POST', '/community/replies/:replyId/vote/', (ctx) => {
    const user = ctx.requireUser();
    const reply = findReply(ctx, ctx.params.replyId!);
    const { c, a } = threadContext(ctx, reply.threadId, user);
    if (!canParticipate(c, user, a)) throw new HttpError(403, `Join ${c.name} to vote.`);
    if (reply.status === 'removed') throw new HttpError(400, 'This reply was removed by a moderator.');
    if (reply.authorId === user.id) throw new HttpError(400, 'You can’t vote on your own post.');
    const value = parseVote(ctx.body.value);
    ctx.db.votes[`${user.id}:reply:${reply.id}`] = value;
    return { score: scoreOf(ctx.db, 'reply', reply.id, reply.baseScore), myVote: value };
  }),

  route('POST', '/community/replies/:replyId/accept/', (ctx) => {
    const user = ctx.requireUser();
    const reply = findReply(ctx, ctx.params.replyId!);
    const { t, c, a } = threadContext(ctx, reply.threadId, user);
    if (!canAcceptIn(t, user, a))
      throw new HttpError(
        403,
        'Only the person who asked, a teacher or a community admin can mark the best answer.',
      );
    if (reply.status === 'removed') throw new HttpError(400, 'A removed reply can’t be the accepted answer.');
    if (t.acceptedReplyId === reply.id) {
      t.acceptedReplyId = null;
    } else {
      t.acceptedReplyId = reply.id;
      if (reply.authorId !== t.authorId) awardBadge(ctx.db, reply.authorId, 'boafo', ctx.now);
      if (reply.authorId !== user.id)
        notify(
          ctx.db,
          reply.authorId,
          {
            kind: 'answer_accepted',
            title: 'Your answer was marked as the best answer',
            body: `“${excerptOf(t.title, 80)}” in ${c.name}. Ayekoo!`,
            href: `/community/t/${t.id}`,
          },
          ctx.now,
        );
    }
    return serializeThread(ctx.db, t, c, user);
  }),

  route('POST', '/community/threads/:threadId/:action/', (ctx) => {
    const user = ctx.requireUser();
    const action = ctx.params.action;
    const { t, c, a } = threadContext(ctx, ctx.params.threadId!, user);
    if (action === 'pin' || action === 'lock') {
      if (!a.perms.canPin) throw new HttpError(403, 'Only community helpers and admins can do that.');
      if (action === 'pin') t.pinned = !t.pinned;
      else t.locked = !t.locked;
    } else if (action === 'remove') {
      if (!a.perms.canRemovePosts)
        throw new HttpError(
          403,
          'Only teachers and Kasa staff who run this community can remove posts. Report it instead.',
        );
      t.status = 'removed';
    } else {
      throw new HttpError(404, 'Unknown action.');
    }
    return serializeThread(ctx.db, t, c, user);
  }),

  route('POST', '/community/replies/:replyId/remove/', (ctx) => {
    const user = ctx.requireUser();
    const reply = findReply(ctx, ctx.params.replyId!);
    const { t, c, a } = threadContext(ctx, reply.threadId, user);
    if (!a.perms.canRemovePosts)
      throw new HttpError(
        403,
        'Only teachers and Kasa staff who run this community can remove posts. Report it instead.',
      );
    reply.status = 'removed';
    if (t.acceptedReplyId === reply.id) t.acceptedReplyId = null;
    return serializeThread(ctx.db, t, c, user);
  }),

  /* Reports go to the Kasa moderation queue */
  route('POST', '/community/reports/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const targetType =
      ctx.body.targetType === 'thread' ? 'thread' : ctx.body.targetType === 'reply' ? 'reply' : null;
    const targetId = typeof ctx.body.targetId === 'string' ? ctx.body.targetId : '';
    const reason = REASONS.find((r) => r === ctx.body.reason);
    if (!targetType || !reason) throw new HttpError(400, 'Choose what’s wrong with this post.');
    const target =
      targetType === 'thread'
        ? ctx.db.threads.find((t) => t.id === targetId)
        : ctx.db.replies.find((r) => r.id === targetId);
    if (!target) throw new HttpError(404, 'That post doesn’t exist any more.');
    if (target.authorId === user.id)
      throw new HttpError(400, 'You can’t report your own post. You can ask a moderator for help instead.');
    const note = str(ctx.body, 'note', { max: 500, label: 'your note' });
    const duplicate = ctx.db.reports.some(
      (r) =>
        r.reporterId === user.id &&
        r.targetType === targetType &&
        r.targetId === targetId &&
        r.status === 'open',
    );
    if (!duplicate) {
      ctx.db.reports.unshift({
        id: `rep-${createId()}`,
        targetType,
        targetId,
        reason,
        note,
        reporterId: user.id,
        createdAt: ctx.now.toISOString(),
        status: 'open',
        resolution: null,
        action: null,
      });
    }
    return { ok: true };
  }),
];
