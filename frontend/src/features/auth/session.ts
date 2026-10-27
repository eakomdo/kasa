/**
 * Who is signed in. The token and a cached copy of the user persist on the
 * device so the app opens offline; GET /me/ refreshes the user on startup.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { configureAuth } from '@/shared/api/client';
import type { Role, User } from '@/shared/api/schemas';

interface SessionState {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: 'kasa-session', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

configureAuth({
  getToken: () => useSession.getState().token,
  onUnauthorized: () => useSession.getState().clear(),
});

/** The signed-in user. Only call inside routes wrapped by <RequireAuth>. */
export function useUser(): User {
  const user = useSession((s) => s.user);
  if (!user) throw new Error('useUser called outside an authenticated route');
  return user;
}

export const isStaffRole = (role: Role) => role === 'moderator' || role === 'admin';
export const canModerate = (user: User | null) => !!user && isStaffRole(user.role);
