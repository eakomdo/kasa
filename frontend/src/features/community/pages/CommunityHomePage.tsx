import { Link, useSearchParams } from 'react-router';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { ButtonLink, EmptyState, ErrorState, Icon, List, Section, Skeleton, Tabs } from '@/shared/ui';
import { useCommunities, useMyCommunities } from '../api';
import { CommunityRow, GuidelinesCard } from '../components/CommunityBits';
import { DiscoverList } from '../components/DiscoverList';
import { ThreadFeed } from '../components/ThreadFeed';
import styles from '../community.module.css';

type Tab = 'groups' | 'discover';

/** Community hub: your groups and their latest discussions, or communities to discover. */
export default function CommunityHomePage() {
  useDocumentTitle('Community');
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'discover' ? 'discover' : 'groups';
  const setTab = (t: Tab) => setParams(t === 'groups' ? {} : { tab: t }, { replace: true });

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Community</h1>
        <ButtonLink to="/community/ask" size="sm">
          Ask
        </ButtonLink>
      </header>

      <Tabs<Tab>
        label="Community view"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'groups', label: 'Your groups' },
          { value: 'discover', label: 'Discover' },
        ]}
      />

      {tab === 'groups' ? <YourGroups /> : <DiscoverList />}

      <GuidelinesCard />
    </div>
  );
}

function YourGroups() {
  const mine = useMyCommunities();
  const created = useCommunities('created');
  const waiting = (created.data ?? []).filter((c) => c.status === 'pending' || c.status === 'rejected');

  return (
    <>
      <div className="stack">
        {mine.isPending ? (
          <div className="stack-sm" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={56} />
            ))}
          </div>
        ) : mine.isError ? (
          <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
        ) : mine.data.length === 0 && waiting.length === 0 ? (
          <EmptyState icon="users" title="You haven’t joined a community yet">
            Join your class with the code from your teacher, or find a study group in Discover.
          </EmptyState>
        ) : (
          <List label="Your communities">
            {[...mine.data, ...waiting].map((c) => (
              <CommunityRow key={c.id} community={c} />
            ))}
          </List>
        )}
        <div className={styles.quietLinks}>
          <Link to="/community/join">
            <Icon name="link" size={16} /> Join with a code
          </Link>
          <Link to="/community/create">
            <Icon name="plus" size={16} /> Start a community
          </Link>
        </div>
      </div>

      <Section label="Latest">
        <ThreadFeed />
      </Section>
    </>
  );
}
