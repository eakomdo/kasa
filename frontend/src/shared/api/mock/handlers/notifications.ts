import type { NotificationList } from '@/shared/api/schemas';
import { route } from '../http';

export const notificationRoutes = [
  route('GET', '/notifications/', (ctx): NotificationList => {
    const user = ctx.requireUser({ allowSuspended: true });
    const mine = ctx.db.notifications.filter((n) => n.userId === user.id);
    return {
      items: mine.slice(0, 50).map(({ userId: _u, ...n }) => n),
      unreadCount: mine.filter((n) => !n.read).length,
    };
  }),

  // Body {ids: string[]} marks those read; an empty body marks everything read.
  route('POST', '/notifications/read/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const ids = Array.isArray(ctx.body.ids) ? (ctx.body.ids as string[]) : null;
    for (const n of ctx.db.notifications)
      if (n.userId === user.id && (!ids || ids.includes(n.id))) n.read = true;
    return { ok: true };
  }),
];
