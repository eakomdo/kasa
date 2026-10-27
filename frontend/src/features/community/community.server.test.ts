/**
 * Contract tests for communities, memberships, discussions and moderation,
 * run against the mock backend. The Django implementation must satisfy the
 * same rules (see docs/api-contract.md).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/shared/api/mock/demoAccounts';
import { getDb, resetDb } from '@/shared/api/mock/db';
import { handleMockRequest } from '@/shared/api/mock/server';
import {
  communityDetailSchema,
  communityMemberSchema,
  communitySchema,
  joinResultSchema,
  notificationListSchema,
  paginated,
  reportSchema,
  threadDetailSchema,
  threadListSchema,
} from '@/shared/api/schemas';
import { z } from 'zod';

async function call(
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
  query: Record<string, string> = {},
) {
  return handleMockRequest({ method, path, token, body, query: new URLSearchParams(query) });
}

async function login(email: string) {
  const res = await call('POST', '/auth/login/', null, { email, password: DEMO_PASSWORD });
  return (res.body as { token: string }).token;
}

const detail = (body: unknown) => communityDetailSchema.parse(body);
const list = (body: unknown) => z.array(communitySchema).parse(body);
const detailOf = async (id: string, token: string) =>
  detail((await call('GET', `/communities/${id}/`, token)).body);

const newCommunity = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ejisu Twi debate club',
  description: 'Students who want to practise speaking Twi by debating fun topics every week.',
  kind: 'interest',
  lang: 'twi',
  bands: ['jhs'],
  joinPolicy: 'request',
  school: null,
  region: 'Ashanti',
  rules: ['Be kind and patient'],
  ...overrides,
});

let ama: string; // student
let kojo: string; // teacher, owner of Asafo JHS 1B
let yaw: string; // moderator
let efua: string; // admin
let kwame: string; // student, owner of Kumasi BECE study group, helper in Asafo
let kofi: string; // student with a pending request to Kumasi

beforeEach(async () => {
  resetDb();
  [ama, kojo, yaw, efua, kwame, kofi] = await Promise.all([
    login(DEMO_ACCOUNTS.student),
    login(DEMO_ACCOUNTS.teacher),
    login(DEMO_ACCOUNTS.moderator),
    login(DEMO_ACCOUNTS.admin),
    login('kwame.owusu@example.com'),
    login('kofi.asare@example.com'),
  ]);
});

describe('community lists', () => {
  it('shows Ama her communities and offers the rest in discovery', async () => {
    const mine = list((await call('GET', '/communities/', ama, undefined, { scope: 'mine' })).body).map(
      (c) => c.id,
    );
    expect(mine).toEqual(expect.arrayContaining(['twi-help', 'bece-prep', 'announcements', 'asafo-jhs1b']));
    const discover = list((await call('GET', '/communities/', ama, undefined, { scope: 'discover' })).body);
    expect(discover.map((c) => c.id)).toContain('kumasi-bece');
    expect(discover.some((c) => c.status !== 'active')).toBe(false);
    expect(discover.some((c) => c.membership?.status === 'member')).toBe(false);
  });

  it('hides pending and rejected communities from everyone but their creator and staff', async () => {
    expect((await call('GET', '/communities/sunyani-readers/', ama)).status).toBe(404);
    expect((await call('GET', '/communities/sunyani-readers/', yaw)).status).toBe(200);
    const akosua = await login('akosua.agyeman@example.com');
    const created = list((await call('GET', '/communities/', akosua, undefined, { scope: 'created' })).body);
    expect(created.find((c) => c.id === 'sunyani-readers')?.status).toBe('pending');
  });

  it('only sends the join code to helpers and above', async () => {
    expect((await detailOf('asafo-jhs1b', ama)).joinCode).toBeNull();
    expect((await detailOf('asafo-jhs1b', kwame)).joinCode).toBe('ASF-7B');
    expect((await detailOf('asafo-jhs1b', kojo)).joinCode).toBe('ASF-7B');
  });
});

describe('creating communities', () => {
  it('puts a student proposal in review and makes them the owner', async () => {
    const res = await call('POST', '/communities/', ama, newCommunity());
    expect(res.status).toBe(200);
    const c = detail(res.body);
    expect(c.status).toBe('pending');
    expect(c.membership).toEqual({ status: 'member', role: 'owner' });
    expect(c.joinCode).toMatch(/^[A-Z]{3}-[1-9][A-Z]$/);
    expect(c.permissions.canRemovePosts).toBe(false);
  });

  it('reviews teacher proposals too, but staff communities go live at once', async () => {
    expect(detail((await call('POST', '/communities/', kojo, newCommunity())).body).status).toBe('pending');
    expect(
      detail((await call('POST', '/communities/', yaw, newCommunity({ name: 'Moderator tips' }))).body)
        .status,
    ).toBe('active');
  });

  it('validates names, descriptions, rules and safety', async () => {
    const short = await call('POST', '/communities/', ama, newCommunity({ name: 'Hi' }));
    expect(short.status).toBe(400);
    expect(short.body).toHaveProperty('name');
    const dup = await call('POST', '/communities/', ama, newCommunity({ name: 'twi HELP' }));
    expect((dup.body as Record<string, string[]>).name?.[0]).toMatch(/already exists/);
    const phone = await call(
      'POST',
      '/communities/',
      ama,
      newCommunity({ description: 'Call me on 024 123 4567 to join our group now' }),
    );
    expect(phone.status).toBe(400);
    const tooMany = await call(
      'POST',
      '/communities/',
      ama,
      newCommunity({ rules: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }),
    );
    expect(tooMany.status).toBe(400);
  });

  it(`limits learners to 3 proposals waiting for review`, async () => {
    for (let i = 0; i < 3; i++)
      await call('POST', '/communities/', ama, newCommunity({ name: `Study circle ${i + 1}` }));
    const res = await call('POST', '/communities/', ama, newCommunity({ name: 'Study circle 4' }));
    expect(res.status).toBe(429);
  });
});

describe('reviewing communities', () => {
  it('approves a proposal and tells the creator', async () => {
    const c = detail((await call('POST', '/communities/', ama, newCommunity())).body);
    const queue = paginated(communitySchema).parse(
      (await call('GET', '/admin/communities/', yaw, undefined, { status: 'pending' })).body,
    );
    expect(queue.items.map((x) => x.id)).toContain(c.id);
    const res = await call('POST', `/admin/communities/${c.id}/review/`, yaw, { decision: 'approve' });
    expect(communitySchema.parse(res.body).status).toBe('active');
    const notes = notificationListSchema.parse((await call('GET', '/notifications/', ama)).body);
    expect(notes.items[0]?.kind).toBe('community_approved');
  });

  it('requires a reason to reject and shows it to the creator', async () => {
    const c = detail((await call('POST', '/communities/', ama, newCommunity())).body);
    expect(
      (await call('POST', `/admin/communities/${c.id}/review/`, yaw, { decision: 'reject' })).status,
    ).toBe(400);
    await call('POST', `/admin/communities/${c.id}/review/`, yaw, {
      decision: 'reject',
      note: 'Please add which school this is for.',
    });
    expect((await detailOf(c.id, ama)).reviewNote).toBe('Please add which school this is for.');
  });

  it('is staff-only', async () => {
    expect((await call('GET', '/admin/communities/', kojo)).status).toBe(403);
  });
});

describe('joining', () => {
  it('joins open communities instantly', async () => {
    const res = joinResultSchema.parse(
      (await call('POST', '/communities/pronunciation/join/', ama, {})).body,
    );
    expect(res.membership).toEqual({ status: 'member', role: 'member' });
  });

  it('sends a request for ask-to-join communities and notifies the managers', async () => {
    const res = joinResultSchema.parse(
      (await call('POST', '/communities/kumasi-bece/join/', ama, { note: 'I am in JHS 1 at Asafo.' })).body,
    );
    expect(res.membership.status).toBe('pending');
    const notes = notificationListSchema.parse((await call('GET', '/notifications/', kwame)).body);
    expect(notes.items[0]).toMatchObject({ kind: 'join_request', href: '/community/c/kumasi-bece/manage' });
    // Cancelling a request
    await call('POST', '/communities/kumasi-bece/leave/', ama);
    expect((await detailOf('kumasi-bece', ama)).membership).toBeNull();
  });

  it('needs the right code for class communities', async () => {
    const esi = await login('esi.quaye@example.com');
    expect((await call('POST', '/communities/asafo-jhs1b/join/', esi, { code: 'WRONG-1' })).status).toBe(400);
    expect(
      joinResultSchema.parse(
        (await call('POST', '/communities/asafo-jhs1b/join/', esi, { code: 'asf-7b' })).body,
      ).membership.status,
    ).toBe('member');
  });

  it('joins by code alone, from a teacher’s link', async () => {
    const esi = await login('esi.quaye@example.com');
    const res = joinResultSchema.parse(
      (await call('POST', '/communities/join-by-code/', esi, { code: ' ASF-7B ' })).body,
    );
    expect(res.community.id).toBe('asafo-jhs1b');
    expect((await call('POST', '/communities/join-by-code/', esi, { code: 'ZZZ-9Z' })).status).toBe(404);
  });
});

describe('managing members', () => {
  it('lets a helper approve requests but not a plain member', async () => {
    const yaa = await login('yaa.pokuaa@example.com'); // member of Kumasi
    expect((await call('POST', '/communities/kumasi-bece/requests/u-kofi/approve/', yaa)).status).toBe(403);
    expect(
      (await call('GET', '/communities/kumasi-bece/members/', yaa, undefined, { status: 'pending' })).status,
    ).toBe(403);
    const pending = z
      .array(communityMemberSchema)
      .parse(
        (await call('GET', '/communities/kumasi-bece/members/', kwame, undefined, { status: 'pending' }))
          .body,
      );
    expect(pending[0]?.requestNote).toMatch(/Bantama/);
    expect((await call('POST', '/communities/kumasi-bece/requests/u-kofi/approve/', kwame)).status).toBe(200);
    expect((await detailOf('kumasi-bece', kofi)).membership).toEqual({ status: 'member', role: 'member' });
    const notes = notificationListSchema.parse((await call('GET', '/notifications/', kofi)).body);
    expect(notes.items[0]?.kind).toBe('join_approved');
  });

  it('declines requests and tells the learner', async () => {
    await call('POST', '/communities/kumasi-bece/requests/u-kofi/decline/', kwame);
    expect((await detailOf('kumasi-bece', kofi)).membership).toBeNull();
    expect(
      notificationListSchema.parse((await call('GET', '/notifications/', kofi)).body).items[0]?.kind,
    ).toBe('join_declined');
  });

  it('never makes a student an admin', async () => {
    const res = await call('PATCH', '/communities/asafo-jhs1b/members/u-ama/', kojo, { role: 'admin' });
    expect(res.status).toBe(400);
    expect((res.body as { detail: string }).detail).toMatch(/teachers or Kasa staff/);
    expect(
      (await call('PATCH', '/communities/asafo-jhs1b/members/u-ama/', kojo, { role: 'helper' })).status,
    ).toBe(200);
  });

  it('lets a student owner appoint helpers but not remove posts or members', async () => {
    const perms = (await detailOf('kumasi-bece', kwame)).permissions;
    expect(perms).toMatchObject({
      canEditSettings: true,
      canRemovePosts: false,
      canManageMembers: false,
      canAppointAdmins: false,
    });
    await call('POST', '/communities/kumasi-bece/requests/u-kofi/approve/', kwame);
    expect(
      (await call('PATCH', '/communities/kumasi-bece/members/u-kofi/', kwame, { role: 'helper' })).status,
    ).toBe(200);
    expect((await call('POST', '/communities/kumasi-bece/members/u-yaa/remove/', kwame)).status).toBe(403);
    expect((await call('POST', '/community/threads/t-kumasi-week/remove/', kwame)).status).toBe(403);
  });

  it('lets a teacher owner remove members, and stops the owner leaving', async () => {
    expect((await call('POST', '/communities/asafo-jhs1b/members/u-yaa/remove/', kojo)).status).toBe(200);
    const leave = await call('POST', '/communities/asafo-jhs1b/leave/', kojo);
    expect(leave.status).toBe(400);
    expect((leave.body as { detail: string }).detail).toMatch(/Hand it to/);
  });

  it('only hands ownership to adults', async () => {
    expect(
      (await call('POST', '/communities/asafo-jhs1b/transfer/', kojo, { userId: 'u-kwame' })).status,
    ).toBe(400);
  });
});

describe('discussions and visibility', () => {
  it('keeps class discussions to members, but staff can read them', async () => {
    const esi = await login('esi.quaye@example.com');
    expect(
      (await call('GET', '/community/threads/', esi, undefined, { communityId: 'asafo-jhs1b' })).status,
    ).toBe(403);
    expect((await call('GET', '/community/threads/t-asafo-reply/', esi)).status).toBe(403);
    const staffView = threadListSchema.parse(
      (await call('GET', '/community/threads/', yaw, undefined, { communityId: 'asafo-jhs1b' })).body,
    );
    expect(staffView.items.length).toBe(2);
    expect(staffView.items[0]?.pinned).toBe(true);
  });

  it('builds the hub feed from joined communities only', async () => {
    const feed = threadListSchema.parse((await call('GET', '/community/threads/', ama)).body);
    const joined = new Set(
      getDb()
        .memberships.filter((m) => m.userId === 'u-ama' && m.status === 'member')
        .map((m) => m.communityId),
    );
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items.every((t) => joined.has(t.communityId))).toBe(true);
  });

  it('stops non-members posting and keeps announcements for staff', async () => {
    const thread = {
      title: 'Where can I find more Ga words?',
      body: 'I finished the greetings unit. What next?',
      tags: [],
    };
    expect(
      (await call('POST', '/community/threads/', ama, { ...thread, communityId: 'ga-help' })).status,
    ).toBe(403);
    expect(
      (await call('POST', '/community/threads/', ama, { ...thread, communityId: 'announcements' })).status,
    ).toBe(403);
    const ok = await call('POST', '/community/threads/', ama, { ...thread, communityId: 'twi-help' });
    expect(threadDetailSchema.parse(ok.body).communityName).toBe('Twi help');
  });

  it('blocks phone numbers in new posts', async () => {
    const res = await call('POST', '/community/threads/', ama, {
      communityId: 'twi-help',
      title: 'Can someone help me revise?',
      body: 'Please call me on 024 123 4567 so we can study.',
      tags: [],
    });
    expect(res.status).toBe(400);
  });

  it('notifies the asker when someone replies', async () => {
    await call('POST', '/community/threads/t-challenge/replies/', kwame, { body: 'Day 3 done!' });
    const notes = notificationListSchema.parse((await call('GET', '/notifications/', ama)).body);
    expect(notes.items[0]).toMatchObject({ kind: 'reply', href: '/community/t/t-challenge' });
  });

  it('lets helpers pin but only adult admins remove', async () => {
    const pin = await call('POST', '/community/threads/t-asafo-reply/pin/', kwame);
    expect(threadDetailSchema.parse(pin.body).pinned).toBe(true);
    expect((await call('POST', '/community/threads/t-asafo-reply/remove/', kwame)).status).toBe(403);
    expect((await call('POST', '/community/replies/r-asafo-reply-1/remove/', kojo)).status).toBe(200);
  });

  it('awards the Boafo badge and notifies when an answer is accepted', async () => {
    await call('POST', '/community/replies/r-asafo-reply-1/accept/', ama);
    const summary = (await call('GET', '/progress/summary/', kwame)).body as {
      badges: Array<{ id: string }>;
    };
    expect(summary.badges.map((b) => b.id)).toContain('boafo');
    expect(
      notificationListSchema.parse((await call('GET', '/notifications/', kwame)).body).items[0]?.kind,
    ).toBe('answer_accepted');
  });
});

describe('reports', () => {
  it('lets moderators remove reported content and suspend the author', async () => {
    const queue = paginated(reportSchema).parse(
      (await call('GET', '/admin/reports/', yaw, undefined, { status: 'open' })).body,
    );
    const rude = queue.items.find((r) => r.targetId === 'r-challenge-4')!;
    expect(rude.reportCount).toBe(2);
    const res = await call('POST', `/admin/reports/${rude.id}/resolve/`, yaw, {
      action: 'suspend_user',
      note: '',
    });
    expect(reportSchema.parse(res.body).status).toBe('resolved');
    expect(getDb().users.find((u) => u.id === 'u-fiifi')?.status).toBe('suspended');
    const fiifi = await login('fiifi.quansah@example.com');
    expect(
      (await call('POST', '/community/threads/t-challenge/replies/', fiifi, { body: 'sorry' })).status,
    ).toBe(403);
  });

  it('approved translation suggestions become teacher-verified lookups', async () => {
    await call('POST', '/admin/suggestions/s-computer/review/', efua, { decision: 'approve' });
    const res = (await call('POST', '/translate/lookup/', ama, { text: 'computer', lang: 'twi' })).body as {
      result: { source: string; output: string };
    };
    expect(res.result).toMatchObject({ source: 'curriculum', output: 'Kɔmputa' });
  });
});
