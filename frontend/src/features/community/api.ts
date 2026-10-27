import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/shared/api/client';
import { qk } from '@/shared/api/queryKeys';
import {
  communityDetailSchema,
  communityMemberSchema,
  communitySchema,
  joinResultSchema,
  okSchema,
  replySchema,
  threadDetailSchema,
  threadListSchema,
  voteResultSchema,
  type Community,
  type CommunityDetail,
  type CommunityRole,
  type CommunitySettingsPatch,
  type NewCommunityInput,
  type NewThreadInput,
  type ReportInput,
  type ThreadDetail,
  type ThreadSort,
  type VoteValue,
} from '@/shared/api/schemas';

export type CommunityScope = 'mine' | 'discover' | 'created';

export interface ThreadQuery {
  communityId?: string;
  sort: ThreadSort;
  q?: string;
}

const enc = encodeURIComponent;
const communityList = z.array(communitySchema);
const memberList = z.array(communityMemberSchema);

export const communityApi = {
  /* Communities */
  communities: (scope: CommunityScope, q?: string, lang?: string) =>
    api.get('/communities/', { query: { scope, q, lang }, schema: communityList }),
  community: (id: string) => api.get(`/communities/${enc(id)}/`, { schema: communityDetailSchema }),
  createCommunity: (input: NewCommunityInput) =>
    api.post('/communities/', { body: input, schema: communityDetailSchema }),
  updateCommunity: (id: string, patch: CommunitySettingsPatch) =>
    api.patch(`/communities/${enc(id)}/`, { body: patch, schema: communityDetailSchema }),
  rotateCode: (id: string) =>
    api.post(`/communities/${enc(id)}/code/rotate/`, { body: {}, schema: communityDetailSchema }),
  join: (id: string, body: { note?: string; code?: string } = {}) =>
    api.post(`/communities/${enc(id)}/join/`, { body, schema: joinResultSchema }),
  joinByCode: (code: string) =>
    api.post('/communities/join-by-code/', { body: { code }, schema: joinResultSchema }),
  leave: (id: string) => api.post(`/communities/${enc(id)}/leave/`, { body: {}, schema: okSchema }),
  members: (id: string, status: 'member' | 'pending', q?: string) =>
    api.get(`/communities/${enc(id)}/members/`, { query: { status, q }, schema: memberList }),
  answerRequest: (id: string, userId: string, decision: 'approve' | 'decline') =>
    api.post(`/communities/${enc(id)}/requests/${enc(userId)}/${decision}/`, { body: {}, schema: okSchema }),
  setRole: (id: string, userId: string, role: Exclude<CommunityRole, 'owner'>) =>
    api.patch(`/communities/${enc(id)}/members/${enc(userId)}/`, {
      body: { role },
      schema: communityMemberSchema,
    }),
  removeMember: (id: string, userId: string) =>
    api.post(`/communities/${enc(id)}/members/${enc(userId)}/remove/`, { body: {}, schema: okSchema }),
  transfer: (id: string, userId: string) =>
    api.post(`/communities/${enc(id)}/transfer/`, { body: { userId }, schema: communityDetailSchema }),

  /* Discussions */
  threads: (params: ThreadQuery, cursor: string | null, signal?: AbortSignal) =>
    api.get('/community/threads/', { query: { ...params, cursor }, schema: threadListSchema, signal }),
  thread: (id: string) => api.get(`/community/threads/${enc(id)}/`, { schema: threadDetailSchema }),
  createThread: (input: NewThreadInput) =>
    api.post('/community/threads/', { body: input, schema: threadDetailSchema }),
  reply: (threadId: string, body: string) =>
    api.post(`/community/threads/${enc(threadId)}/replies/`, { body: { body }, schema: replySchema }),
  vote: (kind: 'thread' | 'reply', id: string, value: VoteValue) =>
    api.post(`/community/${kind === 'thread' ? 'threads' : 'replies'}/${enc(id)}/vote/`, {
      body: { value },
      schema: voteResultSchema,
    }),
  accept: (replyId: string) =>
    api.post(`/community/replies/${enc(replyId)}/accept/`, { body: {}, schema: threadDetailSchema }),
  moderate: (threadId: string, action: 'pin' | 'lock' | 'remove') =>
    api.post(`/community/threads/${enc(threadId)}/${action}/`, { body: {}, schema: threadDetailSchema }),
  removeReply: (replyId: string) =>
    api.post(`/community/replies/${enc(replyId)}/remove/`, { body: {}, schema: threadDetailSchema }),
  report: (input: ReportInput) => api.post('/community/reports/', { body: input, schema: okSchema }),
};

/* ---------- Community queries ---------- */
export function useCommunities(scope: CommunityScope, q = '', lang?: string) {
  return useQuery({
    queryKey: [...qk.community.communities(scope, q), lang ?? ''],
    queryFn: () => communityApi.communities(scope, q || undefined, lang),
    staleTime: 30_000,
  });
}

/** The learner's communities and pending requests. Used on Home and the hub. */
export const useMyCommunities = () => useCommunities('mine');

export function useCommunity(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.community.detail(id),
    queryFn: () => communityApi.community(id),
    staleTime: 15_000,
    enabled: enabled && !!id,
  });
}

export function useMembers(id: string, status: 'member' | 'pending', enabled = true, q = '') {
  return useQuery({
    queryKey: [...qk.community.members(id, status), q],
    queryFn: () => communityApi.members(id, status, q || undefined),
    enabled,
    staleTime: 15_000,
  });
}

/** Anything about memberships changed: refresh lists, the community, its members and the hub feed. */
function refreshCommunity(qc: QueryClient, id?: string) {
  void qc.invalidateQueries({ queryKey: qk.community.communitiesAll });
  void qc.invalidateQueries({ queryKey: ['community', 'threads'] });
  if (id) {
    void qc.invalidateQueries({ queryKey: qk.community.detail(id) });
    void qc.invalidateQueries({ queryKey: ['community', 'members', id] });
  }
}

export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: communityApi.createCommunity,
    onSuccess: (c) => {
      qc.setQueryData(qk.community.detail(c.id), c);
      refreshCommunity(qc);
    },
  });
}

export function useUpdateCommunity(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: CommunitySettingsPatch) => communityApi.updateCommunity(id, patch),
    onSuccess: (c) => {
      qc.setQueryData(qk.community.detail(id), c);
      refreshCommunity(qc);
    },
  });
}

export function useRotateCode(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => communityApi.rotateCode(id),
    onSuccess: (c) => qc.setQueryData(qk.community.detail(id), c),
  });
}

/**
 * Join, request or code-join with an optimistic membership, so the button
 * changes the moment it is tapped and rolls back if the server says no.
 */
export function useJoinCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { community: Community; note?: string; code?: string }) =>
      communityApi.join(v.community.id, { note: v.note, code: v.code }),
    onMutate: async ({ community }) => {
      const key = qk.community.detail(community.id);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CommunityDetail>(key);
      if (prev && community.joinPolicy !== 'code')
        qc.setQueryData<CommunityDetail>(key, {
          ...prev,
          membership:
            community.joinPolicy === 'request'
              ? { status: 'pending', role: null }
              : { status: 'member', role: 'member' },
        });
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_d, _e, v) => refreshCommunity(qc, v.community.id),
  });
}

export function useJoinByCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: communityApi.joinByCode,
    onSuccess: (r) => refreshCommunity(qc, r.community.id),
  });
}

export function useLeaveCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => communityApi.leave(id),
    onSettled: (_d, _e, id) => refreshCommunity(qc, id),
  });
}

export function useAnswerRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; decision: 'approve' | 'decline' }) =>
      communityApi.answerRequest(id, v.userId, v.decision),
    onMutate: async ({ userId }) => {
      const key = [...qk.community.members(id, 'pending'), ''];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<z.infer<typeof memberList>>(key);
      if (prev)
        qc.setQueryData(
          key,
          prev.filter((m) => m.user.id !== userId),
        );
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => refreshCommunity(qc, id),
  });
}

export function useSetRole(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; role: Exclude<CommunityRole, 'owner'> }) =>
      communityApi.setRole(id, v.userId, v.role),
    onSettled: () => refreshCommunity(qc, id),
  });
}

export function useRemoveMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => communityApi.removeMember(id, userId),
    onSettled: () => refreshCommunity(qc, id),
  });
}

export function useTransferOwnership(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => communityApi.transfer(id, userId),
    onSuccess: (c) => qc.setQueryData(qk.community.detail(id), c),
    onSettled: () => refreshCommunity(qc, id),
  });
}

/* ---------- Discussion queries ---------- */
export function useThreads(params: ThreadQuery, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.community.threads({ ...params }),
    queryFn: ({ pageParam, signal }) => communityApi.threads(params, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
    enabled,
  });
}

export function useThread(id: string) {
  return useQuery({
    queryKey: qk.community.thread(id),
    queryFn: () => communityApi.thread(id),
    staleTime: 15_000,
  });
}

export function useCreateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: communityApi.createThread,
    onSuccess: (thread) => {
      qc.setQueryData(qk.community.thread(thread.id), thread);
      refreshCommunity(qc, thread.communityId);
    },
  });
}

export function useReply(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => communityApi.reply(threadId, body),
    onSuccess: (reply) => {
      qc.setQueryData<ThreadDetail>(qk.community.thread(threadId), (t) =>
        t
          ? {
              ...t,
              replies: [...t.replies, reply],
              replyCount: t.replyCount + 1,
              lastActivityAt: reply.createdAt,
            }
          : t,
      );
      void qc.invalidateQueries({ queryKey: ['community', 'threads'] });
    },
  });
}

/** Optimistic vote with rollback. Score moves by the change in this user's vote. */
export function useVote(threadId: string) {
  const qc = useQueryClient();
  const key = qk.community.thread(threadId);
  return useMutation({
    mutationFn: (v: { kind: 'thread' | 'reply'; id: string; value: VoteValue }) =>
      communityApi.vote(v.kind, v.id, v.value),
    onMutate: async ({ kind, id, value }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ThreadDetail>(key);
      qc.setQueryData<ThreadDetail>(key, (t) => {
        if (!t) return t;
        if (kind === 'thread') return { ...t, score: t.score - t.myVote + value, myVote: value };
        return {
          ...t,
          replies: t.replies.map((r) =>
            r.id === id ? { ...r, score: r.score - r.myVote + value, myVote: value } : r,
          ),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (res, { kind, id }) => {
      qc.setQueryData<ThreadDetail>(key, (t) => {
        if (!t) return t;
        if (kind === 'thread') return { ...t, ...res };
        return { ...t, replies: t.replies.map((r) => (r.id === id ? { ...r, ...res } : r)) };
      });
    },
  });
}

function useThreadMutation<V>(threadId: string, fn: (v: V) => Promise<ThreadDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (thread) => {
      qc.setQueryData(qk.community.thread(threadId), thread);
      void qc.invalidateQueries({ queryKey: ['community', 'threads'] });
    },
  });
}

export const useAccept = (threadId: string) => useThreadMutation(threadId, communityApi.accept);
export const useModerateThread = (threadId: string) =>
  useThreadMutation(threadId, (action: 'pin' | 'lock' | 'remove') => communityApi.moderate(threadId, action));
export const useRemoveReply = (threadId: string) => useThreadMutation(threadId, communityApi.removeReply);

export function useReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: communityApi.report,
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.admin.all }),
  });
}

/* ---------- Labels ---------- */
export const TAG_OPTIONS = [
  'twi',
  'ga',
  'bece',
  'wassce',
  'pronunciation',
  'grammar',
  'proverbs',
  'vocabulary',
] as const;

export const TAG_LABELS: Record<string, string> = {
  twi: 'Twi',
  ga: 'Ga',
  bece: 'BECE',
  wassce: 'WASSCE',
  pronunciation: 'Pronunciation',
  grammar: 'Grammar',
  proverbs: 'Proverbs',
  vocabulary: 'Vocabulary',
};

export const KIND_LABELS: Record<Community['kind'], string> = {
  official: 'Kasa community',
  school: 'School',
  class: 'Class',
  study: 'Study group',
  interest: 'Interest group',
};

export const POLICY_LABELS: Record<Community['joinPolicy'], string> = {
  open: 'Open',
  request: 'Approval needed',
  code: 'Class code',
};

export const ROLE_LABELS: Record<CommunityRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  helper: 'Helper',
  member: 'Member',
};

export const POLICY_HINT: Record<Community['joinPolicy'], string> = {
  open: 'Anyone can join straight away',
  request: 'A helper or admin approves each request',
  code: 'Join with the class code from your teacher',
};
