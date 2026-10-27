import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { qk } from '@/shared/api/queryKeys';
import {
  dailyFeatureSchema,
  leaderboardSchema,
  progressSummarySchema,
  type BadgeId,
  type LeaderboardScope,
} from '@/shared/api/schemas';
import { useSession } from '@/features/auth/session';

export const progressApi = {
  summary: (lang: string) =>
    api.get('/progress/summary/', { query: { lang }, schema: progressSummarySchema }),
  leaderboard: (scope: LeaderboardScope, lang: string) =>
    api.get('/leaderboard/', { query: { scope, lang }, schema: leaderboardSchema }),
  dailyFeature: (lang: string) => api.get('/daily-feature/', { query: { lang }, schema: dailyFeatureSchema }),
};

export function useProgressSummary() {
  const lang = useSession((s) => s.user?.lang ?? 'twi');
  return useQuery({
    queryKey: qk.progress(lang),
    queryFn: () => progressApi.summary(lang),
    staleTime: 15_000,
  });
}

export function useLeaderboard(scope: LeaderboardScope) {
  const lang = useSession((s) => s.user?.lang ?? 'twi');
  return useQuery({
    queryKey: qk.leaderboard(scope, lang),
    queryFn: () => progressApi.leaderboard(scope, lang),
  });
}

export function useDailyFeature() {
  const lang = useSession((s) => s.user?.lang ?? 'twi');
  return useQuery({
    queryKey: ['daily-feature', lang],
    queryFn: () => progressApi.dailyFeature(lang),
    staleTime: 60 * 60_000,
  });
}

export const BADGES: Record<BadgeId, { name: string; description: string }> = {
  akwaaba: { name: 'Akwaaba', description: 'Finish your first practice session' },
  nnanson: { name: 'Nnanson', description: 'Practise 7 days in a row' },
  sankofa: { name: 'Sankofa', description: 'Review 100 cards' },
  nyansapo: { name: 'Nyansapɔ', description: 'Master 25 words' },
  boafo: { name: 'Boafo', description: 'Have an answer accepted in the community' },
};
