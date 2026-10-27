import { useMutation, useQueryClient } from '@tanstack/react-query';
import { practiceApi } from '@/features/practice/api';
import { api } from '@/shared/api/client';
import { qk } from '@/shared/api/queryKeys';
import { lookupResultSchema, okSchema, type SuggestionInput } from '@/shared/api/schemas';

export const lookupApi = {
  lookup: (text: string, lang: string) =>
    api.post('/translate/lookup/', { body: { text, lang }, schema: lookupResultSchema }),
  suggest: (input: SuggestionInput) => api.post('/translate/suggestions/', { body: input, schema: okSchema }),
};

export const useLookup = (lang: string) =>
  useMutation({ mutationFn: (text: string) => lookupApi.lookup(text, lang) });

export const useSuggestTranslation = () => useMutation({ mutationFn: lookupApi.suggest });

export function useAddToDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: practiceApi.addToDeck,
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.progressAll }),
  });
}
