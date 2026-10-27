import type { Author, Role } from '@/shared/api/schemas';
import { timeAgo } from '@/shared/lib/date';
import { Chip, type IconName } from '@/shared/ui';
import styles from '../community.module.css';

const ROLE_CHIP: Partial<
  Record<Role, { label: string; tone: 'ok' | 'info'; icon: IconName; title: string }>
> = {
  teacher: { label: 'Teacher', tone: 'ok', icon: 'check', title: 'Verified teacher' },
  moderator: { label: 'Moderator', tone: 'info', icon: 'shield', title: 'Kasa moderator' },
  admin: { label: 'Kasa team', tone: 'info', icon: 'shield', title: 'Kasa team member' },
};

export function RoleChip({ role }: { role: Role }) {
  const chip = ROLE_CHIP[role];
  if (!chip) return null;
  return (
    <Chip tone={chip.tone} icon={chip.icon} title={chip.title}>
      {chip.label}
    </Chip>
  );
}

/** Name, role and class only: learners never see each other's profiles or contact details. */
export function AuthorLine({
  author,
  createdAt,
  verb,
}: {
  author: Author;
  createdAt: string;
  verb?: string;
}) {
  return (
    <div className={styles.author}>
      <span className={styles.authorName}>{author.displayName}</span>
      <RoleChip role={author.role} />
      {author.levelLabel && <span className={styles.authorMeta}>{author.levelLabel}</span>}
      <span className={styles.authorMeta}>
        {verb ? `${verb} ` : ''}
        <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
      </span>
    </div>
  );
}

/** Splits plain text into paragraphs. Posts are never rendered as HTML. */
export function PostBody({ text }: { text: string }) {
  return (
    <div className={styles.postBody}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </div>
  );
}
