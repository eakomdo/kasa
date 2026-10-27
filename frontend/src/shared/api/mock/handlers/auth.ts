import type { UserPatch } from '@/shared/api/schemas';
import { LANGUAGES } from '@/shared/config/languages';
import { LEVELS } from '@/shared/config/levels';
import { REGIONS } from '@/shared/config/regions';
import { createId } from '@/shared/lib/misc';
import { toDisplayName } from '../data/people';
import type { DbUser } from '../db';
import { HttpError, route, str } from '../http';
import { serializeUser } from './serializers';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRoutes = [
  route('POST', '/auth/login/', ({ db, body }) => {
    const email = str(body, 'email').toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.password !== password)
      throw new HttpError(400, 'That email and password don’t match. Check both and try again.');
    const token = createId();
    db.sessions[token] = user.id;
    return { token, user: serializeUser(user) };
  }),

  route('POST', '/auth/register/', ({ db, body, now }) => {
    const name = str(body, 'name', { min: 1, max: 60, label: 'your first name' });
    const email = str(body, 'email').toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!EMAIL.test(email))
      throw new HttpError(400, { email: ['That email doesn’t look right. Check for a missing @ or dot.'] });
    if (password.length < 8)
      throw new HttpError(400, { password: ['Use at least 8 characters for your password.'] });
    if (db.users.some((u) => u.email.toLowerCase() === email))
      throw new HttpError(400, { email: ['An account with this email already exists. Try logging in.'] });
    const user: DbUser = {
      id: `u-${createId()}`,
      name,
      displayName: toDisplayName(name),
      email,
      role: 'student',
      status: 'active',
      onboarded: false,
      lang: 'twi',
      levelId: 'b7',
      dailyGoal: 10,
      voice: 'female',
      school: null,
      region: null,
      guardianEmail: null,
      plan: 'free',
      reminder: { enabled: false, channel: 'whatsapp', time: '18:00' },
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      password,
    };
    db.users.push(user);
    const token = createId();
    db.sessions[token] = user.id;
    return { token, user: serializeUser(user) };
  }),

  route('POST', '/auth/logout/', ({ db, token }) => {
    if (token) delete db.sessions[token];
    return { ok: true };
  }),

  route('GET', '/me/', (ctx) => serializeUser(ctx.requireUser({ allowSuspended: true }))),

  route('PATCH', '/me/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const patch = ctx.body as UserPatch;
    if (patch.name !== undefined) {
      user.name = str(ctx.body, 'name', { min: 1, max: 60, label: 'your name' });
      user.displayName = toDisplayName(user.name);
    }
    if (patch.lang !== undefined) {
      if (!(patch.lang in LANGUAGES)) throw new HttpError(400, { lang: ['Choose Twi or Ga.'] });
      user.lang = patch.lang;
    }
    if (patch.levelId !== undefined) {
      if (!LEVELS.some((l) => l.id === patch.levelId))
        throw new HttpError(400, { levelId: ['Choose your class.'] });
      user.levelId = patch.levelId;
    }
    if (patch.dailyGoal !== undefined) {
      if (![5, 10, 20, 30].includes(patch.dailyGoal))
        throw new HttpError(400, { dailyGoal: ['Pick 5, 10, 20 or 30 cards.'] });
      user.dailyGoal = patch.dailyGoal;
    }
    if (patch.voice !== undefined) user.voice = patch.voice;
    if (patch.school !== undefined)
      user.school = patch.school ? str(ctx.body, 'school', { max: 80 }) || null : null;
    if (patch.region !== undefined) {
      if (patch.region && !(REGIONS as readonly string[]).includes(patch.region))
        throw new HttpError(400, { region: ['Choose a region from the list.'] });
      user.region = patch.region || null;
    }
    if (patch.guardianEmail !== undefined) {
      const g = (patch.guardianEmail ?? '').trim();
      if (g && !EMAIL.test(g))
        throw new HttpError(400, { guardianEmail: ['Check the parent or guardian’s email address.'] });
      user.guardianEmail = g || null;
    }
    if (patch.reminder !== undefined) user.reminder = { ...user.reminder, ...patch.reminder };
    if (patch.onboarded !== undefined) user.onboarded = Boolean(patch.onboarded);
    return serializeUser(user);
  }),
];
