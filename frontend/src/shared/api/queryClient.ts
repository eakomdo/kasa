import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // keep a week so persisted data survives offline restarts
      retry: (failures, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failures < 2;
      },
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst' },
  },
});

/** Persists the query cache to localStorage so saved units and progress open without data. */
export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? safeStorage() : undefined,
  key: 'kasa-query-cache-v1',
  throttleTime: 2000,
});

function safeStorage(): Storage | undefined {
  try {
    const s = window.localStorage;
    s.setItem('__kasa_probe', '1');
    s.removeItem('__kasa_probe');
    return s;
  } catch {
    return undefined;
  }
}
