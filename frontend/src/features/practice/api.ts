import { api } from '@/shared/api/client';
import {
  attemptResultSchema,
  nextBatchSchema,
  vocabItemSchema,
  type AttemptInput,
} from '@/shared/api/schemas';

export const practiceApi = {
  nextBatch: (
    params: { lang: string; level: string; unit?: string | null; limit?: number },
    signal?: AbortSignal,
  ) => api.get('/practice/next-batch/', { query: params, schema: nextBatchSchema, signal }),
  attempt: (input: AttemptInput) =>
    api.post('/practice/attempt/', { body: input, schema: attemptResultSchema }),
  addToDeck: (itemId: string) => api.post('/practice/deck/', { body: { itemId }, schema: vocabItemSchema }),
};
