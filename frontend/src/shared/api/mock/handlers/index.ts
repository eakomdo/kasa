import type { Route } from '../http';
import { adminRoutes } from './admin';
import { authRoutes } from './auth';
import { communityRoutes } from './community';
import { curriculumRoutes } from './curriculum';
import { leaderboardRoutes } from './leaderboard';
import { lookupRoutes } from './lookup';
import { notificationRoutes } from './notifications';
import { practiceRoutes } from './practice';

export const routes: Route[] = [
  ...authRoutes,
  ...curriculumRoutes,
  ...practiceRoutes,
  ...lookupRoutes,
  ...leaderboardRoutes,
  ...communityRoutes,
  ...adminRoutes,
  ...notificationRoutes,
];
