import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { canModerate, useUser } from '@/features/auth/session';
import type { CommunityDetail } from '@/shared/api/schemas';
import { LANGUAGES } from '@/shared/config/languages';
import { BANDS } from '@/shared/config/levels';
import { formatShortDate } from '@/shared/lib/date';
import { useDismiss, useDocumentTitle } from '@/shared/lib/hooks';
import { plural } from '@/shared/lib/misc';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Icon,
  IconLink,
  Notice,
  Section,
  Skeleton,
  Tabs,
  errorMessage,
  toast,
} from '@/shared/ui';
import { KIND_LABELS, POLICY_HINT, useCommunity, useLeaveCommunity, useMembers } from '../api';
import { RoleChip } from '../components/Author';
import { CommunityEmblem, CommunityRoleChip, GuidelinesCard, JoinButton } from '../components/CommunityBits';
import { ThreadFeed } from '../components/ThreadFeed';
import styles from '../community.module.css';

type Tab = 'discussions' | 'members' | 'about';
const TABS: Tab[] = ['discussions', 'members', 'about'];

export default function CommunityPage() {
  const { communityId = '' } = useParams();
  const query = useCommunity(communityId);
  useDocumentTitle(query.data?.name ?? 'Community');

  if (query.isPending) {
    return (
      <div className="stack" aria-busy="true">
        <Skeleton height={180} radius={20} />
        <Skeleton height={44} />
        <Skeleton height={120} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <>
        <IconLink to="/community" icon="back" label="Back to Community" />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }
  return <CommunityView community={query.data} />;
}

function CommunityView({ community: c }: { community: CommunityDetail }) {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t === params.get('tab')) ?? 'discussions';
  const setTab = (t: Tab) => setParams(t === 'discussions' ? {} : { tab: t }, { replace: true });
  const p = c.permissions;
  const isMember = c.membership?.status === 'member';
  const manager = p.canManageRequests || p.canEditSettings;

  return (
    <div className={styles.page}>
      <Link to="/community" className={styles.breadcrumb}>
        <Icon name="back" size={16} /> Community
      </Link>

      <header className={styles.communityHead}>
        <div className={styles.communityTitle}>
          <CommunityEmblem community={c} size={56} />
          <div>
            <h1>{c.name}</h1>
            <p className="small muted">
              {c.official ? 'Kasa community' : KIND_LABELS[c.kind]} · {plural(c.memberCount, 'member')} ·{' '}
              {plural(c.threadCount, 'discussion')}
              {c.school ? ` · ${c.school}` : ''}
            </p>
          </div>
        </div>
        <p className={styles.lede}>{c.description}</p>
        <div className={styles.headActions}>
          <JoinButton community={c} size="md" primary />
          {manager && (
            <ButtonLink to={`/community/c/${c.slug}/manage`} variant="ghost" size="sm">
              Manage
              {c.pendingRequests > 0 && (
                <span className={styles.badgeCount} aria-label={`${c.pendingRequests} join requests waiting`}>
                  {c.pendingRequests}
                </span>
              )}
            </ButtonLink>
          )}
          {c.membership?.role && c.membership.role !== 'member' && (
            <CommunityRoleChip role={c.membership.role} />
          )}
          {c.membership && <MemberMenu community={c} />}
        </div>
      </header>

      <StatusBanner community={c} />

      {p.canView ? (
        <>
          <Tabs<Tab>
            label="Community sections"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'discussions', label: 'Discussions' },
              { value: 'members', label: 'Members' },
              { value: 'about', label: 'About' },
            ]}
          />
          {tab === 'discussions' && <Discussions community={c} />}
          {tab === 'members' && <Members community={c} />}
          {tab === 'about' && <About community={c} />}
        </>
      ) : (
        <Locked community={c} />
      )}
      {!isMember && p.canView && c.joinPolicy === 'open' && c.status === 'active' && (
        <p className={styles.footnote}>Join to ask questions, reply and vote.</p>
      )}
      <GuidelinesCard />
    </div>
  );
}

function StatusBanner({ community: c }: { community: CommunityDetail }) {
  if (c.status === 'pending')
    return (
      <Notice tone="warn" title="Waiting for Kasa review">
        A Kasa moderator checks every new community before it goes live. You’ll get a notification as soon as
        it’s reviewed.
      </Notice>
    );
  if (c.status === 'rejected')
    return (
      <Notice tone="danger" title="Not approved">
        {c.reviewNote ?? 'A Kasa moderator didn’t approve this community.'} You can start a new community that
        follows the rules.
      </Notice>
    );
  if (c.status === 'archived')
    return (
      <Notice title="This community is archived">
        You can still read it, but new posts and members are turned off.
      </Notice>
    );
  if (c.membership?.status === 'pending')
    return (
      <Notice title="Request sent">
        A helper or admin will answer your request. We’ll send you a notification when they do.
      </Notice>
    );
  return null;
}

function MemberMenu({ community: c }: { community: CommunityDetail }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const leave = useLeaveCommunity();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  useDismiss(ref, open, () => setOpen(false));
  if (c.membership?.status !== 'member') return null;

  return (
    <div className={styles.menuWrap} ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="check" size={16} />
        Member
        <Icon name="chevronDown" size={16} />
      </Button>
      {open && (
        <div className={styles.menu} role="menu">
          <Link to="/community/guidelines" role="menuitem">
            <Icon name="shield" size={18} /> Community rules
          </Link>
          {c.permissions.canLeave ? (
            confirm ? (
              <button
                type="button"
                role="menuitem"
                className={styles.danger}
                onClick={() =>
                  leave.mutate(c.id, {
                    onSuccess: () => {
                      toast(`You left ${c.name}.`);
                      navigate('/community');
                    },
                    onError: (e) => toast(errorMessage(e), 'error'),
                  })
                }
              >
                <Icon name="logout" size={18} /> Yes, leave {c.name}
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={styles.danger}
                onClick={() => setConfirm(true)}
              >
                <Icon name="logout" size={18} /> Leave community
              </button>
            )
          ) : (
            <p className="small muted" style={{ padding: '8px 12px', margin: 0 }}>
              You own this community. Hand it over in Manage before leaving.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Discussions({ community: c }: { community: CommunityDetail }) {
  const canAsk = c.permissions.canPost;
  return (
    <>
      {canAsk ? (
        <div>
          <ButtonLink
            to={`/community/ask?community=${c.id}`}
            variant={isMemberOf(c) ? 'primary' : 'ghost'}
            size="sm"
            icon="plus"
          >
            Ask in this community
          </ButtonLink>
        </div>
      ) : c.staffOnlyPosting && c.membership?.status === 'member' ? (
        <Notice>Only the Kasa team posts here. Turn on notifications so you don’t miss news.</Notice>
      ) : null}
      <ThreadFeed communityId={c.id} canAsk={canAsk} />
    </>
  );
}

function Members({ community: c }: { community: CommunityDetail }) {
  const user = useUser();
  const allowed = c.membership?.status === 'member' || canModerate(user);
  const members = useMembers(c.id, 'member', allowed);
  if (!allowed)
    return (
      <EmptyState icon="users" title="Join to see who’s here">
        Member lists are only visible to members, to protect everyone’s privacy.
      </EmptyState>
    );
  if (members.isPending) return <Skeleton height={200} />;
  if (members.isError) return <ErrorState error={members.error} onRetry={() => void members.refetch()} />;
  return (
    <>
      <ul className={styles.memberList}>
        {members.data.map((m) => (
          <li key={m.user.id} className={styles.memberRow}>
            <span className={styles.memberName}>
              <strong>
                {m.user.displayName}
                {m.user.id === user.id ? ' (you)' : ''}
              </strong>
              <span className="small muted">
                {m.user.levelLabel ?? ''}
                {m.joinedAt ? `${m.user.levelLabel ? ' · ' : ''}joined ${formatShortDate(m.joinedAt)}` : ''}
              </span>
            </span>
            <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <CommunityRoleChip role={m.role} />
              <RoleChip role={m.user.role} />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function RulesCard({ rules }: { rules: string[] }) {
  return (
    <Section label="Community rules">
      <ol className={styles.rules}>
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </Section>
  );
}

function About({ community: c }: { community: CommunityDetail }) {
  const bands = c.bands.length
    ? BANDS.filter((b) => c.bands.includes(b.id))
        .map((b) => b.name)
        .join(', ')
    : 'Every class';
  return (
    <>
      <Section label="About">
        <dl className="stack-sm small" style={{ margin: 0 }}>
          <AboutRow
            label="Who it’s for"
            value={`${c.lang ? `${LANGUAGES[c.lang].name} learners` : 'Twi and Ga learners'} · ${bands}`}
          />
          <AboutRow label="How to join" value={POLICY_HINT[c.joinPolicy]} />
          {c.school && <AboutRow label="School" value={c.school} />}
          {c.region && <AboutRow label="Region" value={c.region} />}
          <AboutRow
            label="Started by"
            value={`${c.createdBy.displayName} · ${formatShortDate(c.createdAt)}`}
          />
        </dl>
      </Section>
      {c.rules.length > 0 && <RulesCard rules={c.rules} />}
    </>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
      <dt className="muted" style={{ minWidth: 110 }}>
        {label}
      </dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}

function Locked({ community: c }: { community: CommunityDetail }) {
  if (c.status !== 'active') return null;
  return (
    <div className={styles.locked}>
      <Icon name="lock" size={32} />
      <h2>{c.joinPolicy === 'code' ? 'This is a class community' : 'Members only'}</h2>
      <p>
        {c.joinPolicy === 'code'
          ? 'Discussions are for this class. Ask your teacher for the class code, then join to read and post.'
          : 'Ask to join and a helper or admin will let you in. Then you can read and post.'}
      </p>
      <JoinButton community={c} size="md" />
    </div>
  );
}

const isMemberOf = (c: CommunityDetail) => c.membership?.status === 'member';
