/** Converts db rows to API shapes. The Django serializers must produce the same output. */
import type { Author, User } from '@/shared/api/schemas';
import { getLevel } from '@/shared/config/levels';
import type { Db, DbUser } from '../db';

export function serializeUser(u: DbUser): User {
  const { password: _p, lastActiveAt: _l, ...user } = u;
  return user;
}

export function serializeAuthor(db: Db, userId: string): Author {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return { id: userId, displayName: 'Former learner', role: 'student', levelLabel: null };
  return {
    id: u.id,
    displayName: u.displayName,
    role: u.role,
    levelLabel: u.role === 'student' ? getLevel(u.levelId).short : null,
  };
}
