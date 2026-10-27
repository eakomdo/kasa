import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/shared/api/client';
import { qk } from '@/shared/api/queryKeys';
import {
  authResponseSchema,
  okSchema,
  userSchema,
  type LoginInput,
  type RegisterInput,
  type User,
  type UserPatch,
} from '@/shared/api/schemas';
import { useSession } from './session';

export const authApi = {
  login: (input: LoginInput) => api.post('/auth/login/', { body: input, schema: authResponseSchema }),
  register: (input: RegisterInput) =>
    api.post('/auth/register/', { body: input, schema: authResponseSchema }),
  logout: () => api.post('/auth/logout/', { body: {}, schema: okSchema }),
  me: () => api.get('/me/', { schema: userSchema }),
  updateMe: (patch: UserPatch) => api.patch('/me/', { body: patch, schema: userSchema }),
};

export function useLogin() {
  const setSession = useSession((s) => s.setSession);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ token, user }) => {
      qc.clear();
      setSession(token, user);
    },
  });
}

export function useRegister() {
  const setSession = useSession((s) => s.setSession);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ token, user }) => {
      qc.clear();
      setSession(token, user);
    },
  });
}

export function useLogout() {
  const clear = useSession((s) => s.clear);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout().catch(() => ({ ok: true as const })),
    onSettled: () => {
      clear();
      qc.clear();
    },
  });
}

/** Keeps the cached user fresh (role changes, suspension) whenever the app opens. */
export function useRefreshMe() {
  const token = useSession((s) => s.token);
  const setUser = useSession((s) => s.setUser);
  const query = useQuery({ queryKey: qk.me, queryFn: authApi.me, enabled: !!token, staleTime: 5 * 60_000 });
  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);
  return query;
}

/**
 * Optimistic profile update: the UI changes instantly and rolls back if the
 * server refuses. Changing language or level reshapes most screens, so those
 * invalidate curriculum and progress queries.
 */
export function useUpdateMe() {
  const qc = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  return useMutation({
    mutationFn: authApi.updateMe,
    onMutate: (patch) => {
      const prev = useSession.getState().user;
      if (prev) setUser({ ...prev, ...patch, reminder: { ...prev.reminder, ...patch.reminder } } as User);
      return { prev };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) setUser(ctx.prev);
    },
    onSuccess: (user, patch) => {
      setUser(user);
      qc.setQueryData(qk.me, user);
      if (patch.lang || patch.levelId || patch.dailyGoal) {
        void qc.invalidateQueries({ queryKey: qk.unitsAll });
        void qc.invalidateQueries({ queryKey: qk.progressAll });
      }
    },
  });
}
