/**
 * Demo accounts and sample learners. Every account's password is "demo1234".
 * Schools are fictional. Peers exist only to make leaderboards feel real.
 */
import type { BadgeId, User } from '@/shared/api/schemas';
import { addDays, dayKey } from '@/shared/lib/date';
import type { DbProgress, DbUser } from '../db';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../demoAccounts';
import { UNITS, wordIdsOf } from './curriculum';

export { DEMO_ACCOUNTS, DEMO_PASSWORD };

type Seed = Pick<User, 'id' | 'name' | 'email' | 'role' | 'lang' | 'levelId' | 'school' | 'region'> &
  Partial<Pick<User, 'guardianEmail' | 'status' | 'plan'>> & {
    joinedDaysAgo: number;
    activeDaysAgo?: number;
  };

const SEEDS: Seed[] = [
  {
    id: 'u-ama',
    name: 'Ama Mensah',
    email: DEMO_ACCOUNTS.student,
    role: 'student',
    lang: 'twi',
    levelId: 'b7',
    school: 'Asafo M/A JHS',
    region: 'Ashanti',
    joinedDaysAgo: 40,
  },
  {
    id: 'u-kojo',
    name: 'Kojo Boateng',
    email: DEMO_ACCOUNTS.teacher,
    role: 'teacher',
    lang: 'twi',
    levelId: 'b9',
    school: 'Asafo M/A JHS',
    region: 'Ashanti',
    joinedDaysAgo: 120,
  },
  {
    id: 'u-naa',
    name: 'Naa Tetteh',
    email: 'naa.tetteh@example.com',
    role: 'teacher',
    lang: 'ga',
    levelId: 'b8',
    school: 'Osu Klottey JHS',
    region: 'Greater Accra',
    joinedDaysAgo: 95,
  },
  {
    id: 'u-yaw',
    name: 'Yaw Darko',
    email: DEMO_ACCOUNTS.moderator,
    role: 'moderator',
    lang: 'twi',
    levelId: 'shs3',
    school: null,
    region: 'Eastern',
    joinedDaysAgo: 150,
  },
  {
    id: 'u-efua',
    name: 'Efua Asante',
    email: DEMO_ACCOUNTS.admin,
    role: 'admin',
    lang: 'twi',
    levelId: 'shs3',
    school: null,
    region: 'Central',
    joinedDaysAgo: 200,
  },
  {
    id: 'u-kwame',
    name: 'Kwame Owusu',
    email: 'kwame.owusu@example.com',
    role: 'student',
    lang: 'twi',
    levelId: 'b8',
    school: 'Asafo M/A JHS',
    region: 'Ashanti',
    joinedDaysAgo: 60,
    activeDaysAgo: 1,
  },
  {
    id: 'u-yaa',
    name: 'Yaa Pokuaa',
    email: 'yaa.pokuaa@example.com',
    role: 'student',
    lang: 'twi',
    levelId: 'b7',
    school: 'Asafo M/A JHS',
    region: 'Ashanti',
    joinedDaysAgo: 22,
  },
  {
    id: 'u-kofi',
    name: 'Kofi Asare',
    email: 'kofi.asare@example.com',
    role: 'student',
    lang: 'twi',
    levelId: 'b9',
    school: 'Bantama Community JHS',
    region: 'Ashanti',
    joinedDaysAgo: 75,
    activeDaysAgo: 2,
  },
  {
    id: 'u-akosua',
    name: 'Akosua Agyeman',
    email: 'akosua.agyeman@example.com',
    role: 'student',
    lang: 'twi',
    levelId: 'shs1',
    school: 'Sunyani Hilltop SHS',
    region: 'Bono',
    joinedDaysAgo: 33,
  },
  {
    id: 'u-esi',
    name: 'Esi Quaye',
    email: 'esi.quaye@example.com',
    role: 'student',
    lang: 'twi',
    levelId: 'b6',
    school: 'Cape Coast Harbour Primary',
    region: 'Central',
    guardianEmail: 'parent.quaye@example.com',
    joinedDaysAgo: 12,
  },
  {
    id: 'u-nii',
    name: 'Nii Armah',
    email: 'nii.armah@example.com',
    role: 'student',
    lang: 'ga',
    levelId: 'b8',
    school: 'Osu Klottey JHS',
    region: 'Greater Accra',
    joinedDaysAgo: 48,
  },
  {
    id: 'u-adjoa',
    name: 'Adjoa Lamptey',
    email: 'adjoa.lamptey@example.com',
    role: 'student',
    lang: 'ga',
    levelId: 'shs2',
    school: 'Teshie Model SHS',
    region: 'Greater Accra',
    joinedDaysAgo: 5,
    activeDaysAgo: 0,
  },
  {
    id: 'u-kwesi',
    name: 'Kwesi Appiah',
    email: 'kwesi.appiah@example.com',
    role: 'student',
    lang: 'twi',
    levelId: 'b8',
    school: null,
    region: 'Western',
    joinedDaysAgo: 3,
    activeDaysAgo: 0,
  },
  {
    id: 'u-fiifi',
    name: 'Fiifi Quansah',
    email: 'fiifi.quansah@example.com',
    role: 'student',
    lang: 'twi',
    levelId: 'shs2',
    school: 'Cape Coast Harbour SHS',
    region: 'Central',
    joinedDaysAgo: 18,
    activeDaysAgo: 1,
  },
];

/** "Ama Mensah" -> "Ama M." — the only name other learners see. */
export const toDisplayName = (name: string): string => {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
};

export function makeUser(seed: Seed, now: Date): DbUser {
  return {
    id: seed.id,
    name: seed.name,
    displayName: toDisplayName(seed.name),
    email: seed.email,
    role: seed.role,
    status: seed.status ?? 'active',
    onboarded: true,
    lang: seed.lang,
    levelId: seed.levelId,
    dailyGoal: 10,
    voice: 'female',
    school: seed.school,
    region: seed.region,
    guardianEmail: seed.guardianEmail ?? null,
    plan: seed.plan ?? 'free',
    reminder: { enabled: false, channel: 'whatsapp', time: '18:00' },
    createdAt: addDays(now, -seed.joinedDaysAgo).toISOString(),
    lastActiveAt: addDays(now, -(seed.activeDaysAgo ?? 0)).toISOString(),
    password: DEMO_PASSWORD,
  };
}

export const seedPeople = (now: Date): DbUser[] => SEEDS.map((s) => makeUser(s, now));

/** Ama's progress: a few days into JHS 1 Twi, with words due today. */
export function seedLearning(now: Date) {
  const progress: Record<string, Record<string, DbProgress>> = { 'u-ama': {} };
  const mastery = [4, 4, 3, 3, 2, 2, 1, 1, 1, 1];
  const greet = UNITS.find((u) => u.id === 'tw-greet')!;
  const family = UNITS.find((u) => u.id === 'tw-family')!;
  wordIdsOf(greet).forEach((id, i) => {
    progress['u-ama']![id] = {
      mastery: mastery[i]!,
      nextReviewAt: addDays(now, i % 3 === 0 ? -1 : 2).toISOString(),
      lastSeenAt: addDays(now, -2).toISOString(),
    };
  });
  wordIdsOf(family)
    .slice(0, 4)
    .forEach((id) => {
      progress['u-ama']![id] = {
        mastery: 1,
        nextReviewAt: addDays(now, -0.5).toISOString(),
        lastSeenAt: addDays(now, -1).toISOString(),
      };
    });

  const activity: Record<string, Record<string, { count: number; xp: number }>> = { 'u-ama': {} };
  [12, 8, 15, 10].forEach((count, i) => {
    activity['u-ama']![dayKey(addDays(now, -(i + 1)))] = { count, xp: count * 8 };
  });
  activity['u-ama']![dayKey(addDays(now, -6))] = { count: 6, xp: 42 };

  const badges: Record<string, Array<{ id: BadgeId; earnedAt: string }>> = {
    'u-ama': [{ id: 'akwaaba', earnedAt: addDays(now, -6).toISOString() }],
  };
  return { progress, activity, badges };
}

/** Leaderboard peers who are not real accounts in the mock db. */
export const PEERS: Array<{
  displayName: string;
  school: string | null;
  region: string;
  lang: 'twi' | 'ga';
  xp: number;
}> = [
  { displayName: 'Kwame O.', school: 'Asafo M/A JHS', region: 'Ashanti', lang: 'twi', xp: 640 },
  { displayName: 'Yaa P.', school: 'Asafo M/A JHS', region: 'Ashanti', lang: 'twi', xp: 410 },
  { displayName: 'Serwaa B.', school: 'Asafo M/A JHS', region: 'Ashanti', lang: 'twi', xp: 355 },
  { displayName: 'Osei K.', school: 'Asafo M/A JHS', region: 'Ashanti', lang: 'twi', xp: 220 },
  { displayName: 'Afia D.', school: 'Asafo M/A JHS', region: 'Ashanti', lang: 'twi', xp: 150 },
  { displayName: 'Kofi A.', school: 'Bantama Community JHS', region: 'Ashanti', lang: 'twi', xp: 720 },
  { displayName: 'Adwoa S.', school: 'Bantama Community JHS', region: 'Ashanti', lang: 'twi', xp: 505 },
  { displayName: 'Kwabena F.', school: 'Ejisu Model JHS', region: 'Ashanti', lang: 'twi', xp: 830 },
  { displayName: 'Akosua A.', school: 'Sunyani Hilltop SHS', region: 'Bono', lang: 'twi', xp: 910 },
  { displayName: 'Esi Q.', school: 'Cape Coast Harbour Primary', region: 'Central', lang: 'twi', xp: 300 },
  { displayName: 'Fiifi Q.', school: 'Cape Coast Harbour SHS', region: 'Central', lang: 'twi', xp: 460 },
  { displayName: 'Mawuli T.', school: 'Ho Riverside JHS', region: 'Volta', lang: 'twi', xp: 275 },
  { displayName: 'Abdul-Rahman I.', school: 'Tamale Central JHS', region: 'Northern', lang: 'twi', xp: 690 },
  { displayName: 'Nii A.', school: 'Osu Klottey JHS', region: 'Greater Accra', lang: 'ga', xp: 580 },
  { displayName: 'Adjoa L.', school: 'Teshie Model SHS', region: 'Greater Accra', lang: 'ga', xp: 330 },
  { displayName: 'Naa K.', school: 'Osu Klottey JHS', region: 'Greater Accra', lang: 'ga', xp: 470 },
  { displayName: 'Tetteh N.', school: 'La Presby JHS', region: 'Greater Accra', lang: 'ga', xp: 615 },
];
