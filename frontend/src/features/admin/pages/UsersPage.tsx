import { useState } from 'react';
import { useUser } from '@/features/auth/session';
import type { AdminUser, Role } from '@/shared/api/schemas';
import { getLanguage } from '@/shared/config/languages';
import { timeAgo } from '@/shared/lib/date';
import { useDebouncedValue, useDocumentTitle, useIsDesktop } from '@/shared/lib/hooks';
import { plural } from '@/shared/lib/misc';
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  ErrorState,
  Notice,
  PageHeader,
  SelectField,
  Skeleton,
  TextField,
  errorMessage,
  toast,
} from '@/shared/ui';
import { ROLE_LABELS, useAdminUsers, useUpdateUser, type UserFilters } from '../api';
import styles from '../admin.module.css';

const ROLES: Role[] = ['student', 'teacher', 'moderator', 'admin'];

function StatusChip({ status }: { status: AdminUser['status'] }) {
  return status === 'active' ? <Chip tone="ok">Active</Chip> : <Chip tone="danger">Suspended</Chip>;
}

export default function UsersPage() {
  useDocumentTitle('People');
  const me = useUser();
  const isAdmin = me.role === 'admin';
  const desktop = useIsDesktop();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserFilters['role']>('');
  const [status, setStatus] = useState<UserFilters['status']>('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 350);
  const users = useAdminUsers({ q, role, status, page });
  const update = useUpdateUser();
  const [confirm, setConfirm] = useState<AdminUser | null>(null);

  const changeRole = (u: AdminUser, next: Role) =>
    update.mutate(
      { id: u.id, role: next },
      {
        onSuccess: (res) => toast(`${res.displayName} is now ${ROLE_LABELS[res.role].toLowerCase()}.`),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );

  const toggleStatus = () => {
    if (!confirm) return;
    const next = confirm.status === 'active' ? 'suspended' : 'active';
    update.mutate(
      { id: confirm.id, status: next },
      {
        onSuccess: (res) =>
          toast(
            res.status === 'suspended'
              ? `${res.displayName} is suspended from posting.`
              : `${res.displayName} can post again.`,
          ),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );
    setConfirm(null);
  };

  const canChangeStatus = (u: AdminUser) => u.id !== me.id && u.role !== 'admin';
  const roleControl = (u: AdminUser) =>
    isAdmin && u.id !== me.id ? (
      <select
        aria-label={`Role for ${u.displayName}`}
        value={u.role}
        onChange={(e) => changeRole(u, e.target.value as Role)}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    ) : (
      <span>{ROLE_LABELS[u.role]}</span>
    );
  const statusButton = (u: AdminUser) =>
    canChangeStatus(u) ? (
      <Button size="sm" variant={u.status === 'active' ? 'danger' : 'ghost'} onClick={() => setConfirm(u)}>
        {u.status === 'active' ? 'Suspend' : 'Reactivate'}
      </Button>
    ) : null;

  const items = users.data?.items ?? [];
  const totalPages = users.data ? Math.max(1, Math.ceil(users.data.total / users.data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="People" subtitle="Learners, teachers and the Kasa team." />
      {!isAdmin && (
        <Notice title="Only admins can change roles">
          As a moderator you can suspend and reactivate learners. Ask an admin to verify a teacher or add a
          moderator.
        </Notice>
      )}
      <div className={styles.filters}>
        <TextField
          label="Search"
          type="search"
          placeholder="Name, email or school"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <SelectField
          label="Role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as UserFilters['role']);
            setPage(1);
          }}
        >
          <option value="">Everyone</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as UserFilters['status']);
            setPage(1);
          }}
        >
          <option value="">Any</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </SelectField>
      </div>

      {users.isPending ? (
        <Skeleton height={320} />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="users" title="No one matches">
          Try a different name, or clear the filters.
        </EmptyState>
      ) : desktop ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">Kasa accounts</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Class and language</th>
                <th scope="col">School and region</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Reports</th>
                <th scope="col">Last active</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.displayName}</strong>
                    <br />
                    <span className="muted">{u.email}</span>
                  </td>
                  <td>
                    {u.levelLabel}
                    <br />
                    <span className="muted">{getLanguage(u.lang).name}</span>
                  </td>
                  <td>
                    {u.school ?? <span className="muted">No school</span>}
                    <br />
                    <span className="muted">{u.region ?? 'No region'}</span>
                  </td>
                  <td>{roleControl(u)}</td>
                  <td>
                    <StatusChip status={u.status} />
                  </td>
                  <td className={styles.num}>{u.reportsAgainst}</td>
                  <td className="muted">{timeAgo(u.lastActiveAt)}</td>
                  <td>{statusButton(u)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className={styles.userCards}>
          {items.map((u) => (
            <li key={u.id} className={styles.userCard}>
              <div className="row-between">
                <strong>{u.displayName}</strong>
                <StatusChip status={u.status} />
              </div>
              <span className="small muted" style={{ overflowWrap: 'anywhere' }}>
                {u.email}
              </span>
              <span className="small">
                {u.levelLabel} · {getLanguage(u.lang).name}
                {u.school ? ` · ${u.school}` : ''}
              </span>
              <span className="small muted">
                {plural(u.reportsAgainst, 'report')} · active {timeAgo(u.lastActiveAt)}
              </span>
              <div className="row-between">
                <span className="row small">Role: {roleControl(u)}</span>
                {statusButton(u)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {users.data && totalPages > 1 && (
        <div className={styles.pager}>
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="small muted">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {users.data && <p className="small muted">{plural(users.data.total, 'account')}</p>}

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={
          confirm?.status === 'active'
            ? `Suspend ${confirm.displayName}?`
            : `Reactivate ${confirm?.displayName ?? ''}?`
        }
      >
        {confirm && (
          <div className="stack">
            <p>
              {confirm.status === 'active'
                ? 'They can keep learning, but can’t post, reply or vote in the community until someone reactivates them.'
                : 'They’ll be able to post, reply and vote in the community again.'}
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button variant={confirm.status === 'active' ? 'danger' : 'primary'} onClick={toggleStatus}>
                {confirm.status === 'active' ? 'Suspend' : 'Reactivate'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
