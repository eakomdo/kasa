/**
 * Route map. Every page is lazy-loaded so a learner on 3G downloads only the
 * screen they open. Pages export a default component.
 */
import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { GuestOnly, RequireAuth, RequireOnboarded, RequireRole } from '@/features/auth/guards';
import { PageSpinner } from '@/shared/ui';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

type PageModule = { default: ComponentType };
const page = (path: string | undefined, load: () => Promise<PageModule>): RouteObject => ({
  ...(path === undefined ? { index: true } : { path }),
  lazy: async () => ({ Component: (await load()).default }),
});

const appPages: RouteObject[] = [
  page(undefined, () => import('@/features/home/HomePage')),
  page('learn', () => import('@/features/curriculum/pages/UnitsPage')),
  page('learn/:unitId', () => import('@/features/curriculum/pages/UnitPage')),
  page('practice', () => import('@/features/practice/pages/PracticeHubPage')),
  page('practice/session', () => import('@/features/practice/pages/PracticeSessionPage')),
  page('lookup', () => import('@/features/lookup/LookupPage')),
  // Community: hub, discovery, creation, joining, a community's own pages, threads
  page('community', () => import('@/features/community/pages/CommunityHomePage')),
  page('community/discover', () => import('@/features/community/pages/DiscoverPage')),
  page('community/create', () => import('@/features/community/pages/CreateCommunityPage')),
  page('community/join', () => import('@/features/community/pages/JoinCommunityPage')),
  page('community/ask', () => import('@/features/community/pages/NewThreadPage')),
  page('community/guidelines', () => import('@/features/community/pages/GuidelinesPage')),
  page('community/c/:communityId', () => import('@/features/community/pages/CommunityPage')),
  page('community/c/:communityId/manage', () => import('@/features/community/pages/ManageCommunityPage')),
  page('community/t/:threadId', () => import('@/features/community/pages/ThreadPage')),
  page('notifications', () => import('@/features/notifications/NotificationsPage')),
  page('leaderboard', () => import('@/features/progress/pages/LeaderboardPage')),
  page('profile', () => import('@/features/progress/pages/ProfilePage')),
  page('settings', () => import('@/features/settings/SettingsPage')),
  page('*', () => import('./NotFoundPage')),
];

const adminPages: RouteObject[] = [
  page(undefined, () => import('@/features/admin/pages/AdminOverviewPage')),
  page('reports', () => import('@/features/admin/pages/ReportsPage')),
  page('communities', () => import('@/features/admin/pages/CommunitiesPage')),
  page('suggestions', () => import('@/features/admin/pages/SuggestionsPage')),
  page('users', () => import('@/features/admin/pages/UsersPage')),
];

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    HydrateFallback: PageSpinner,
    children: [
      {
        element: <GuestOnly />,
        children: [
          page('welcome', () => import('@/features/auth/pages/WelcomePage')),
          page('login', () => import('@/features/auth/pages/LoginPage')),
          page('register', () => import('@/features/auth/pages/RegisterPage')),
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          page('onboarding/:step', () => import('@/features/onboarding/OnboardingPage')),
          {
            element: <RequireOnboarded />,
            children: [
              { element: <AppShell />, children: appPages },
              {
                path: 'admin',
                element: <RequireRole roles={['moderator', 'admin']} />,
                children: [
                  {
                    lazy: async () => ({ Component: (await import('@/features/admin/AdminLayout')).default }),
                    children: adminPages,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
