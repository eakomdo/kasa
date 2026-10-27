import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { qk } from '@/shared/api/queryKeys';
import { notificationListSchema, okSchema, type NotificationList } from '@/shared/api/schemas';
import { useOnline } from '@/shared/lib/hooks';

export const notificationsApi = {
  list: () => api.get('/notifications/', { schema: notificationListSchema }),
  markRead: (ids?: string[]) =>
    api.post('/notifications/read/', { body: ids ? { ids } : {}, schema: okSchema }),
};

/** Polls gently (every 60 s, only while the tab is visible and online) to save data. */
export function useNotifications() {
  const online = useOnline();
  return useQuery({
    queryKey: qk.notifications,
    queryFn: notificationsApi.list,
    refetchInterval: online ? 60_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onMutate: (ids) => {
      const prev = qc.getQueryData<NotificationList>(qk.notifications);
      if (prev) {
        const items = prev.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n));
        qc.setQueryData<NotificationList>(qk.notifications, {
          items,
          unreadCount: items.filter((n) => !n.read).length,
        });
      }
      return { prev };
    },
    onError: (_e, _ids, ctx) => ctx?.prev && qc.setQueryData(qk.notifications, ctx.prev),
  });
}
