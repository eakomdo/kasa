import type { NotificationKind } from '@/shared/api/schemas';
import { createId } from '@/shared/lib/misc';
import type { Db } from './db';

/** Adds an in-app notification. In production this also fans out to push, WhatsApp or SMS per the user's settings. */
export function notify(
  db: Db,
  userId: string,
  n: { kind: NotificationKind; title: string; body: string; href?: string | null },
  now: Date = new Date(),
): void {
  db.notifications.unshift({
    id: `n-${createId()}`,
    userId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href ?? null,
    createdAt: now.toISOString(),
    read: false,
  });
}
