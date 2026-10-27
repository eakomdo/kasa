import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { qk } from '@/shared/api/queryKeys';
import {
  adminOverviewSchema,
  adminUserSchema,
  communitySchema,
  paginated,
  reportSchema,
  suggestionSchema,
  type AdminUser,
  type Community,
  type Report,
  type ReportAction,
  type Role,
  type Suggestion,
  type SuggestionReview,
} from '@/shared/api/schemas';

export type ReportStatus = Report['status'];
export type SuggestionStatus = Suggestion['status'];
export interface UserFilters {
  q: string;
  role: Role | '';
  status: AdminUser['status'] | '';
  page: number;
}

const reportPage = paginated(reportSchema);
const suggestionPage = paginated(suggestionSchema);
const userPage = paginated(adminUserSchema);
const communityPage = paginated(communitySchema);
export type CommunityStatus = Community['status'];

export const adminApi = {
  overview: () => api.get('/admin/overview/', { schema: adminOverviewSchema }),
  reports: (status: ReportStatus, page = 1) =>
    api.get('/admin/reports/', { query: { status, page }, schema: reportPage }),
  resolveReport: (id: string, action: ReportAction, note: string) =>
    api.post(`/admin/reports/${encodeURIComponent(id)}/resolve/`, {
      body: { action, note },
      schema: reportSchema,
    }),
  suggestions: (status: SuggestionStatus, page = 1) =>
    api.get('/admin/suggestions/', { query: { status, page }, schema: suggestionPage }),
  reviewSuggestion: (id: string, review: SuggestionReview) =>
    api.post(`/admin/suggestions/${encodeURIComponent(id)}/review/`, {
      body: review,
      schema: suggestionSchema,
    }),
  users: (f: UserFilters) => api.get('/admin/users/', { query: { ...f, pageSize: 20 }, schema: userPage }),
  communities: (status: CommunityStatus, page = 1) =>
    api.get('/admin/communities/', { query: { status, page }, schema: communityPage }),
  reviewCommunity: (id: string, decision: 'approve' | 'reject', note: string) =>
    api.post(`/admin/communities/${encodeURIComponent(id)}/review/`, {
      body: { decision, note },
      schema: communitySchema,
    }),
  archiveCommunity: (id: string) =>
    api.post(`/admin/communities/${encodeURIComponent(id)}/archive/`, { body: {}, schema: communitySchema }),
  updateUser: (id: string, patch: { role?: Role; status?: AdminUser['status'] }) =>
    api.patch(`/admin/users/${encodeURIComponent(id)}/`, { body: patch, schema: adminUserSchema }),
};

export function useAdminOverview() {
  return useQuery({ queryKey: qk.admin.overview, queryFn: adminApi.overview, staleTime: 30_000 });
}

export function useReports(status: ReportStatus) {
  return useQuery({
    queryKey: qk.admin.reports(status),
    queryFn: () => adminApi.reports(status),
    staleTime: 10_000,
  });
}

/** Removes the row from the open queue straight away, then refreshes everything it touched. */
export function useResolveReport() {
  const qc = useQueryClient();
  const key = qk.admin.reports('open');
  return useMutation({
    mutationFn: (v: { id: string; action: ReportAction; note: string }) =>
      adminApi.resolveReport(v.id, v.action, v.note),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<{ items: Report[]; total: number; page: number; pageSize: number }>(key);
      if (prev)
        qc.setQueryData(key, {
          ...prev,
          items: prev.items.filter((r) => r.id !== id),
          total: prev.total - 1,
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      void qc.invalidateQueries({ queryKey: qk.community.all });
    },
  });
}

export function useSuggestions(status: SuggestionStatus) {
  return useQuery({
    queryKey: qk.admin.suggestions(status),
    queryFn: () => adminApi.suggestions(status),
    staleTime: 10_000,
  });
}

export function useReviewSuggestion() {
  const qc = useQueryClient();
  const key = qk.admin.suggestions('pending');
  return useMutation({
    mutationFn: (v: { id: string } & SuggestionReview) =>
      adminApi.reviewSuggestion(v.id, { decision: v.decision, finalTranslation: v.finalTranslation }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<{ items: Suggestion[]; total: number; page: number; pageSize: number }>(
        key,
      );
      if (prev)
        qc.setQueryData(key, {
          ...prev,
          items: prev.items.filter((s) => s.id !== id),
          total: prev.total - 1,
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.admin.all }),
  });
}

export function useAdminUsers(filters: UserFilters) {
  return useQuery({
    queryKey: qk.admin.users({ ...filters }),
    queryFn: () => adminApi.users(filters),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; role?: Role; status?: AdminUser['status'] }) =>
      adminApi.updateUser(v.id, { role: v.role, status: v.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      void qc.invalidateQueries({ queryKey: qk.community.all });
    },
  });
}

export const REASON_LABELS: Record<Report['reason'], string> = {
  spam: 'Spam or adverts',
  bullying: 'Unkind or bullying',
  inappropriate: 'Not suitable',
  personal_info: 'Personal information',
  wrong_translation: 'Wrong Twi or Ga',
  other: 'Something else',
};

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  teacher: 'Teacher',
  moderator: 'Moderator',
  admin: 'Admin',
};

export function useAdminCommunities(status: CommunityStatus) {
  return useQuery({
    queryKey: qk.admin.communities(status),
    queryFn: () => adminApi.communities(status),
    staleTime: 10_000,
  });
}

/** Approve, reject or archive: the card leaves the current list at once, then everything refreshes. */
export function useCommunityDecision(status: CommunityStatus) {
  const qc = useQueryClient();
  const key = qk.admin.communities(status);
  return useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'reject' | 'archive'; note?: string }) =>
      v.action === 'archive'
        ? adminApi.archiveCommunity(v.id)
        : adminApi.reviewCommunity(v.id, v.action, v.note ?? ''),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<{ items: Community[]; total: number; page: number; pageSize: number }>(
        key,
      );
      if (prev)
        qc.setQueryData(key, {
          ...prev,
          items: prev.items.filter((c) => c.id !== id),
          total: prev.total - 1,
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      void qc.invalidateQueries({ queryKey: qk.community.all });
    },
  });
}
