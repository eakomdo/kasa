/**
 * Contract tests: the mock backend must honour the same rules we expect from
 * Django. When the real API exists, these cases become its acceptance tests.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { lookupResultSchema, nextBatchSchema, progressSummarySchema, userSchema } from '@/shared/api/schemas';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demoAccounts';
import { resetDb } from './db';
import { handleMockRequest } from './server';

async function call(
  method: string,
  path: string,
  body?: unknown,
  token: string | null = null,
  query: Record<string, string> = {},
) {
  return handleMockRequest({ method, path, body, token, query: new URLSearchParams(query) });
}

async function login(email: string = DEMO_ACCOUNTS.student) {
  const res = await call('POST', '/auth/login/', { email, password: DEMO_PASSWORD });
  return (res.body as { token: string }).token;
}

beforeEach(() => {
  resetDb();
});

describe('auth', () => {
  it('logs in a demo account and returns a valid user', async () => {
    const res = await call('POST', '/auth/login/', { email: DEMO_ACCOUNTS.student, password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(userSchema.parse((res.body as { user: unknown }).user).displayName).toBe('Ama M.');
  });

  it('rejects a wrong password with a helpful message', async () => {
    const res = await call('POST', '/auth/login/', { email: DEMO_ACCOUNTS.student, password: 'nope' });
    expect(res.status).toBe(400);
    expect((res.body as { detail: string }).detail).toMatch(/don’t match/);
  });

  it('validates registration fields', async () => {
    const res = await call('POST', '/auth/register/', { name: 'Kofi', email: 'bad', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('email');
  });

  it('requires a token for private endpoints', async () => {
    expect((await call('GET', '/me/')).status).toBe(401);
  });

  it('validates profile updates', async () => {
    const token = await login();
    const bad = await call('PATCH', '/me/', { dailyGoal: 7 }, token);
    expect(bad.status).toBe(400);
    const ok = await call('PATCH', '/me/', { dailyGoal: 20, region: 'Volta' }, token);
    expect(userSchema.parse(ok.body)).toMatchObject({ dailyGoal: 20, region: 'Volta' });
  });
});

describe('practice', () => {
  it('serves due words before new ones, with three distractors each', async () => {
    const token = await login();
    const res = await call('GET', '/practice/next-batch/', undefined, token, {
      lang: 'twi',
      level: 'b7',
      limit: '10',
    });
    const { cards } = nextBatchSchema.parse(res.body);
    expect(cards.length).toBe(10);
    expect(cards[0]!.isNew).toBe(false);
    for (const c of cards) {
      expect(c.distractors).toHaveLength(3);
      expect(c.distractors).not.toContain(c.translation);
    }
  });

  it('treats attempts as idempotent by clientId', async () => {
    const token = await login();
    const attempt = {
      clientId: 'abc-123',
      itemId: 'tw-num-w1',
      correct: true,
      mode: 'flashcard',
      answeredAt: new Date().toISOString(),
    };
    await call('POST', '/practice/attempt/', attempt, token);
    await call('POST', '/practice/attempt/', attempt, token);
    const summary = progressSummarySchema.parse(
      (await call('GET', '/progress/summary/', undefined, token, { lang: 'twi' })).body,
    );
    expect(summary.todayCount).toBe(1);
  });

  it('reports the seeded streak and awards the first badge', async () => {
    const token = await login();
    const summary = progressSummarySchema.parse(
      (await call('GET', '/progress/summary/', undefined, token, { lang: 'twi' })).body,
    );
    expect(summary.streak).toBe(4);
    expect(summary.badges.map((b) => b.id)).toContain('akwaaba');
    expect(summary.history).toHaveLength(14);
  });
});

describe('lookup', () => {
  it('prefers teacher-verified syllabus entries', async () => {
    const token = await login();
    const r = lookupResultSchema.parse(
      (await call('POST', '/translate/lookup/', { text: 'Thank you', lang: 'twi' }, token)).body,
    );
    expect(r.result).toMatchObject({ output: 'Medaase', source: 'curriculum' });
  });

  it('translates Twi back to English, even typed without special letters', async () => {
    const token = await login();
    const r = lookupResultSchema.parse(
      (await call('POST', '/translate/lookup/', { text: 'mmiensa', lang: 'twi' }, token)).body,
    );
    expect(r.direction).toBe('to_english');
    expect(r.result?.output).toBe('Three');
  });

  it('labels words outside the syllabus as Khaya AI output', async () => {
    const token = await login();
    const r = lookupResultSchema.parse(
      (await call('POST', '/translate/lookup/', { text: 'friend', lang: 'twi' }, token)).body,
    );
    expect(r.result?.source).toBe('khaya');
  });

  it('accepts translation suggestions from learners', async () => {
    const token = await login();
    const res = await call(
      'POST',
      '/translate/suggestions/',
      { lang: 'twi', query: 'school bag', suggestion: 'Sukuu bag', currentTranslation: null },
      token,
    );
    expect(res.status).toBe(200);
  });
});
