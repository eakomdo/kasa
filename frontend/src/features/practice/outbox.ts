/**
 * Offline-safe answer delivery. Each answer carries a clientId, so the server
 * can ignore duplicates. Answers recorded without signal wait here and are
 * sent in order when the phone reconnects.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ApiError } from '@/shared/api/client';
import { queryClient } from '@/shared/api/queryClient';
import { qk } from '@/shared/api/queryKeys';
import type { AttemptInput, AttemptResult } from '@/shared/api/schemas';
import { practiceApi } from './api';

interface OutboxState {
  pending: AttemptInput[];
  flushing: boolean;
  enqueue: (a: AttemptInput) => void;
  flush: () => Promise<void>;
}

export const usePracticeOutbox = create<OutboxState>()(
  persist(
    (set, get) => ({
      pending: [],
      flushing: false,
      enqueue: (a) => set({ pending: [...get().pending, a] }),
      flush: async () => {
        if (get().flushing || get().pending.length === 0) return;
        set({ flushing: true });
        try {
          while (get().pending.length > 0) {
            const next = get().pending[0]!;
            try {
              await practiceApi.attempt(next);
            } catch (err) {
              if (err instanceof ApiError && (err.isOffline || err.status >= 500 || err.isUnauthorized))
                break;
              // A 4xx means the answer can never succeed (e.g. word removed): drop it.
            }
            set({ pending: get().pending.slice(1) });
          }
        } finally {
          set({ flushing: false });
          void queryClient.invalidateQueries({ queryKey: qk.progressAll });
        }
      },
    }),
    {
      name: 'kasa-outbox',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ pending: s.pending }),
    },
  ),
);

/** Sends one answer; queues it if the phone is offline. Returns null when queued. */
export async function submitAttempt(input: AttemptInput): Promise<AttemptResult | null> {
  try {
    return await practiceApi.attempt(input);
  } catch (err) {
    if (err instanceof ApiError && (err.isOffline || err.status >= 500)) {
      usePracticeOutbox.getState().enqueue(input);
      return null;
    }
    throw err;
  }
}
