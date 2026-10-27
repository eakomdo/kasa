import type { Community } from '@/shared/api/schemas';
import { plural } from '@/shared/lib/misc';
import { KIND_LABELS, ROLE_LABELS } from '../api';

/** One quiet line describing a community: kind, members, school, or its review status. */
export function communityMeta(c: Community): string {
  if (c.status === 'pending') return 'Waiting for Kasa review';
  if (c.status === 'rejected') return 'Not approved';
  if (c.status === 'archived') return 'Archived';
  if (c.membership?.status === 'pending') return 'Request sent';
  const role = c.membership?.role;
  const parts = [
    c.official ? 'Kasa community' : KIND_LABELS[c.kind],
    plural(c.memberCount, 'member'),
    role && role !== 'member' ? ROLE_LABELS[role] : null,
  ];
  return parts.filter(Boolean).join(' · ');
}
