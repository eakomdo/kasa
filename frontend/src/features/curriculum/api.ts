import { useQuery, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useSession } from '@/features/auth/session';
import { api } from '@/shared/api/client';
import { qk } from '@/shared/api/queryKeys';
import { unitSchema, vocabItemSchema } from '@/shared/api/schemas';

const CONTENT_STALE = 5 * 60_000;

export const curriculumApi = {
  units: (lang: string, levelId: string) =>
    api.get(`/levels/${levelId}/units/`, { query: { lang }, schema: z.array(unitSchema) }),
  unit: (unitId: string) => api.get(`/units/${unitId}/`, { schema: unitSchema }),
  vocabulary: (unitId: string) =>
    api.get(`/units/${unitId}/vocabulary/`, { schema: z.array(vocabItemSchema) }),
  phrases: (unitId: string) => api.get(`/units/${unitId}/phrases/`, { schema: z.array(vocabItemSchema) }),
};

export function useUnits() {
  const lang = useSession((s) => s.user?.lang ?? 'twi');
  const levelId = useSession((s) => s.user?.levelId ?? 'b7');
  return useQuery({
    queryKey: qk.units(lang, levelId),
    queryFn: () => curriculumApi.units(lang, levelId),
    staleTime: CONTENT_STALE,
  });
}

export const useUnit = (unitId: string) =>
  useQuery({
    queryKey: qk.unit(unitId),
    queryFn: () => curriculumApi.unit(unitId),
    staleTime: CONTENT_STALE,
  });

export const useVocabulary = (unitId: string) =>
  useQuery({
    queryKey: qk.vocabulary(unitId),
    queryFn: () => curriculumApi.vocabulary(unitId),
    staleTime: CONTENT_STALE,
  });

export const usePhrases = (unitId: string) =>
  useQuery({
    queryKey: qk.phrases(unitId),
    queryFn: () => curriculumApi.phrases(unitId),
    staleTime: CONTENT_STALE,
  });

/**
 * Downloads a unit into the persisted query cache (and, in production, the
 * service worker's curriculum cache) so it opens without data.
 */
export async function saveUnitForOffline(qc: QueryClient, unitId: string) {
  await Promise.all([
    qc.prefetchQuery({ queryKey: qk.unit(unitId), queryFn: () => curriculumApi.unit(unitId) }),
    qc.prefetchQuery({ queryKey: qk.vocabulary(unitId), queryFn: () => curriculumApi.vocabulary(unitId) }),
    qc.prefetchQuery({ queryKey: qk.phrases(unitId), queryFn: () => curriculumApi.phrases(unitId) }),
  ]);
}

/** "Nkyia" when a local title exists, otherwise the English one (Ga units). */
export const unitTitle = (u: { titleLocal: string | null; titleEn: string }) => u.titleLocal ?? u.titleEn;
