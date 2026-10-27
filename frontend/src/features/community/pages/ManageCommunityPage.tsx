import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useUser } from '@/features/auth/session';
import { ApiError } from '@/shared/api/client';
import type { CommunityDetail, CommunityMember, CommunityRole, JoinPolicy } from '@/shared/api/schemas';
import { timeAgo } from '@/shared/lib/date';
import { useDebouncedValue, useDocumentTitle } from '@/shared/lib/hooks';
import { checkPostSafety } from '@/shared/lib/safety';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Notice,
  PageHeader,
  SelectField,
  Skeleton,
  TextArea,
  TextField,
  errorMessage,
  toast,
} from '@/shared/ui';
import {
  POLICY_HINT,
  ROLE_LABELS,
  useAnswerRequest,
  useCommunity,
  useMembers,
  useRemoveMember,
  useRotateCode,
  useSetRole,
  useTransferOwnership,
  useUpdateCommunity,
} from '../api';
import { RoleChip } from '../components/Author';
import { CommunityRoleChip } from '../components/CommunityBits';
import { RuleEditor } from '../components/RuleEditor';
import styles from '../community.module.css';

export default function ManageCommunityPage() {
  const { communityId = '' } = useParams();
  const query = useCommunity(communityId);
  useDocumentTitle(query.data ? `Manage ${query.data.name}` : 'Manage community');

  if (query.isPending) return <Skeleton height={320} radius={20} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const c = query.data;
  const p = c.permissions;
  if (!p.canManageRequests && !p.canEditSettings) {
    return (
      <>
        <PageHeader backTo={`/community/c/${c.slug}`} title="Manage community" />
        <EmptyState icon="shield" title="Only helpers and admins can manage this community">
          If you’d like to help run {c.name}, ask its owner to make you a helper.
        </EmptyState>
      </>
    );
  }

  const studentOwner = c.membership?.role === 'owner' && !p.canRemovePosts;

  return (
    <>
      <PageHeader
        backTo={`/community/c/${c.slug}`}
        title={`Manage ${c.name}`}
        subtitle="Requests, members, invites and settings"
      />
      {c.status === 'pending' && (
        <Notice tone="warn" title="Waiting for Kasa review">
          You can get things ready, but nobody can join until a Kasa moderator approves the community.
        </Notice>
      )}
      {studentOwner && (
        <Notice icon="shield" title="Problems with a post or a member?">
          Tap Report on the post. Kasa moderators handle removing posts and members, so you never have to deal
          with it alone.
        </Notice>
      )}
      <div className={styles.wide}>
        <>
          {p.canManageRequests && <Requests community={c} />}
          <Members community={c} />
        </>
        <>
          {c.joinCode && <Invite community={c} />}
          {p.canEditSettings && <Settings community={c} />}
          {c.membership?.role === 'owner' && <Transfer community={c} />}
        </>
      </div>
    </>
  );
}

function Requests({ community: c }: { community: CommunityDetail }) {
  const pending = useMembers(c.id, 'pending');
  const answer = useAnswerRequest(c.id);
  return (
    <section className={styles.panel} aria-labelledby="requests-heading">
      <h2 id="requests-heading">Join requests</h2>
      {pending.isPending ? (
        <Skeleton height={80} />
      ) : pending.isError ? (
        <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
      ) : pending.data.length === 0 ? (
        <p className="small muted">
          No requests waiting.{' '}
          {c.joinPolicy === 'request'
            ? 'New requests show up here and in your notifications.'
            : c.joinPolicy === 'code'
              ? 'People join straight away with your class code, so there’s nothing to approve.'
              : 'Anyone can join this open community, so there’s nothing to approve.'}
        </p>
      ) : (
        <ul className={styles.memberList}>
          {pending.data.map((m) => (
            <li key={m.user.id} className={styles.memberRow}>
              <span className={styles.memberName}>
                <strong>{m.user.displayName}</strong>
                <span className="small muted">
                  {m.user.levelLabel ?? ''} {m.requestedAt ? `· asked ${timeAgo(m.requestedAt)}` : ''}
                </span>
              </span>
              <span className={styles.memberControls}>
                <Button
                  size="sm"
                  icon="check"
                  onClick={() =>
                    answer.mutate(
                      { userId: m.user.id, decision: 'approve' },
                      {
                        onSuccess: () => toast(`${m.user.displayName} is in. They’ll get a notification.`),
                        onError: (e) => toast(errorMessage(e), 'error'),
                      },
                    )
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    answer.mutate(
                      { userId: m.user.id, decision: 'decline' },
                      {
                        onSuccess: () => toast('Request declined.'),
                        onError: (e) => toast(errorMessage(e), 'error'),
                      },
                    )
                  }
                >
                  Decline
                </Button>
              </span>
              {m.requestNote && <p className={styles.requestNote}>“{m.requestNote}”</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ROLE_OPTIONS: Array<Exclude<CommunityRole, 'owner'>> = ['member', 'helper', 'admin'];

function Members({ community: c }: { community: CommunityDetail }) {
  const user = useUser();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const members = useMembers(c.id, 'member', true, q);
  const setRole = useSetRole(c.id);
  const remove = useRemoveMember(c.id);
  const [removing, setRemoving] = useState<CommunityMember | null>(null);
  const p = c.permissions;
  const isOwner = c.membership?.role === 'owner';
  const canAppointHelpers = p.canManageMembers || isOwner;

  const editableRoles = (m: CommunityMember) => {
    if (m.role === 'owner' || m.user.id === user.id) return [];
    if (m.role === 'admin' && !p.canAppointAdmins) return [];
    if (!canAppointHelpers) return [];
    return ROLE_OPTIONS.filter((r) => r !== 'admin' || (p.canAppointAdmins && m.user.role !== 'student'));
  };

  return (
    <section className={styles.panel} aria-labelledby="members-heading">
      <h2 id="members-heading">Members</h2>
      <TextField
        label="Search members"
        hideLabel
        type="search"
        placeholder="Search by name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <p className="small muted">
        Helpers approve requests and pin posts. Admins must be teachers or Kasa staff; they can also remove
        posts and members.
      </p>
      {members.isPending ? (
        <Skeleton height={160} />
      ) : members.isError ? (
        <ErrorState error={members.error} onRetry={() => void members.refetch()} />
      ) : (
        <ul className={styles.memberList}>
          {members.data.map((m) => {
            const roles = editableRoles(m);
            return (
              <li key={m.user.id} className={styles.memberRow}>
                <span className={styles.memberName}>
                  <strong>
                    {m.user.displayName}
                    {m.user.id === user.id ? ' (you)' : ''}
                  </strong>
                  <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {m.user.levelLabel && <span className="small muted">{m.user.levelLabel}</span>}
                    <RoleChip role={m.user.role} />
                  </span>
                </span>
                <span className={styles.memberControls}>
                  {roles.length > 1 && m.role ? (
                    <select
                      aria-label={`Role for ${m.user.displayName}`}
                      value={m.role}
                      disabled={setRole.isPending}
                      onChange={(e) =>
                        setRole.mutate(
                          { userId: m.user.id, role: e.target.value as Exclude<CommunityRole, 'owner'> },
                          {
                            onSuccess: (r) =>
                              toast(
                                `${m.user.displayName} is now ${r.role === 'member' ? 'a member' : `a ${ROLE_LABELS[r.role!].toLowerCase()}`}.`,
                              ),
                            onError: (err) => toast(errorMessage(err), 'error'),
                          },
                        )
                      }
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <CommunityRoleChip role={m.role} />
                  )}
                  {p.canManageMembers &&
                    m.role !== 'owner' &&
                    m.user.id !== user.id &&
                    (m.role !== 'admin' || p.canAppointAdmins) && (
                      <IconButton
                        icon="close"
                        label={`Remove ${m.user.displayName}`}
                        onClick={() => setRemoving(m)}
                      />
                    )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.user.displayName ?? ''}?`}
      >
        <p>
          They’ll lose access to {c.name}
          {c.joinPolicy === 'open'
            ? ', but can join again because it’s open'
            : ' and need to ask or use the code to come back'}
          . If they broke the rules, report their posts too so Kasa moderators know.
        </p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              removing &&
              remove.mutate(removing.user.id, {
                onSuccess: () => {
                  toast(`${removing.user.displayName} was removed.`);
                  setRemoving(null);
                },
                onError: (e) => toast(errorMessage(e), 'error'),
              })
            }
          >
            Remove member
          </Button>
        </div>
      </Dialog>
    </section>
  );
}

function Invite({ community: c }: { community: CommunityDetail }) {
  const rotate = useRotateCode(c.id);
  const [confirm, setConfirm] = useState(false);
  const link = `${window.location.origin}/community/join?code=${encodeURIComponent(c.joinCode ?? '')}`;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied.`);
    } catch {
      toast(`Couldn’t copy automatically. Press and hold the ${what.toLowerCase()} to copy it.`, 'error');
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="invite-heading">
      <h2 id="invite-heading">Invite people</h2>
      <p className="small muted">
        {c.joinPolicy === 'code'
          ? 'Share the code in class or send the link on WhatsApp. Anyone with it can join.'
          : 'Anyone with this code or link joins straight away, even though the community asks people to request.'}
      </p>
      <div className={styles.codeBox}>
        <strong aria-label={`Class code ${c.joinCode?.split('').join(' ')}`}>{c.joinCode}</strong>
        <Button size="sm" variant="ghost" icon="copy" onClick={() => void copy(c.joinCode ?? '', 'Code')}>
          Copy code
        </Button>
      </div>
      <div className={styles.linkBox}>
        <Icon name="link" size={16} />
        <span style={{ flex: 1, minWidth: 0, userSelect: 'all' }}>{link}</span>
        <IconButton icon="copy" label="Copy invite link" onClick={() => void copy(link, 'Link')} />
      </div>
      {c.permissions.canEditSettings &&
        (confirm ? (
          <div className="stack-sm">
            <p className="small">
              The old code and link stop working straight away. People already in stay in.
            </p>
            <div className="row">
              <Button
                size="sm"
                variant="danger"
                loading={rotate.isPending}
                onClick={() =>
                  rotate.mutate(undefined, {
                    onSuccess: (next) => {
                      toast(`New code: ${next.joinCode}`);
                      setConfirm(false);
                    },
                    onError: (e) => toast(errorMessage(e), 'error'),
                  })
                }
              >
                Make a new code
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="subtle" onClick={() => setConfirm(true)}>
            Get a new code
          </Button>
        ))}
    </section>
  );
}

function Settings({ community: c }: { community: CommunityDetail }) {
  const update = useUpdateCommunity(c.id);
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description);
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>(c.joinPolicy);
  const [rules, setRules] = useState<string[]>(c.rules);
  const server = update.error instanceof ApiError ? update.error.fieldErrors : {};
  const safety =
    [name, description, ...rules].map((t) => (t.trim() ? checkPostSafety(t) : null)).find(Boolean) ?? null;

  if (c.official)
    return (
      <Notice title="Official community">
        Settings for official communities are managed by the Kasa team.
      </Notice>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (safety) return;
    update.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        joinPolicy,
        rules: rules.map((r) => r.trim()).filter(Boolean),
      },
      {
        onSuccess: () => toast('Settings saved.'),
        onError: (err) =>
          !(err instanceof ApiError && Object.keys(err.fieldErrors).length) &&
          toast(errorMessage(err), 'error'),
      },
    );
  };

  return (
    <form className={styles.panel} onSubmit={submit} noValidate aria-labelledby="settings-heading">
      <h2 id="settings-heading">Settings</h2>
      <TextField
        label="Name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        error={server.name}
      />
      <TextArea
        label="Description"
        value={description}
        maxLength={400}
        rows={3}
        onChange={(e) => setDescription(e.target.value)}
        error={server.description}
      />
      <SelectField
        label="How people join"
        value={joinPolicy}
        onChange={(e) => setJoinPolicy(e.target.value as JoinPolicy)}
        hint={POLICY_HINT[joinPolicy]}
      >
        <option value="open">Open: anyone can join</option>
        <option value="request">Ask to join: helpers approve requests</option>
        <option value="code">Class code: join with the code</option>
      </SelectField>
      <RuleEditor rules={rules} onChange={setRules} error={server.rules} />
      {safety && <Notice tone="danger">{safety}</Notice>}
      <Button type="submit" size="sm" loading={update.isPending} disabled={!!safety}>
        Save settings
      </Button>
    </form>
  );
}

function Transfer({ community: c }: { community: CommunityDetail }) {
  const members = useMembers(c.id, 'member');
  const transfer = useTransferOwnership(c.id);
  const [to, setTo] = useState('');
  const [confirm, setConfirm] = useState(false);
  const adults = (members.data ?? []).filter((m) => m.role !== 'owner' && m.user.role !== 'student');
  const chosen = adults.find((m) => m.user.id === to);

  return (
    <section className={styles.panel} aria-labelledby="transfer-heading">
      <h2 id="transfer-heading">Hand over ownership</h2>
      <p className="small muted">
        The new owner must be a teacher or Kasa staff member who has joined. You’ll stay on as an admin or
        helper.
      </p>
      {adults.length === 0 ? (
        <p className="small">
          No teachers have joined yet. Invite one with the code, then come back.{' '}
          <Link to="/community/guidelines">Why?</Link>
        </p>
      ) : (
        <>
          <SelectField label="New owner" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Choose a teacher</option>
            {adults.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.displayName}
              </option>
            ))}
          </SelectField>
          <Button size="sm" variant="danger" disabled={!chosen} onClick={() => setConfirm(true)}>
            Hand over
          </Button>
        </>
      )}
      <Dialog
        open={confirm && !!chosen}
        onClose={() => setConfirm(false)}
        title={`Make ${chosen?.user.displayName ?? ''} the owner?`}
      >
        <p>They’ll control settings, members and admins. Only they can hand it back.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={transfer.isPending}
            onClick={() =>
              chosen &&
              transfer.mutate(chosen.user.id, {
                onSuccess: () => {
                  toast(`${chosen.user.displayName} now owns ${c.name}.`);
                  setConfirm(false);
                },
                onError: (e) => toast(errorMessage(e), 'error'),
              })
            }
          >
            Hand over ownership
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
