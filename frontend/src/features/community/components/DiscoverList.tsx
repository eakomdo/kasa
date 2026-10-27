import { useState } from 'react';
import { Link } from 'react-router';
import { useUser } from '@/features/auth/session';
import { LANGUAGES } from '@/shared/config/languages';
import { useDebouncedValue } from '@/shared/lib/hooks';
import { EmptyState, ErrorState, List, Segmented, Skeleton, TextField } from '@/shared/ui';
import { useCommunities } from '../api';
import { CommunityRow, JoinButton } from './CommunityBits';
import styles from '../community.module.css';

type LangFilter = 'mine' | 'all';

/** Search plus a divided list of communities you can join, each with its join action. */
export function DiscoverList() {
  const user = useUser();
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState<LangFilter>('mine');
  const q = useDebouncedValue(search.trim(), 300);
  const list = useCommunities('discover', q, lang === 'all' ? 'all' : undefined);

  return (
    <div className="stack">
      <div className={styles.controls}>
        <TextField
          label="Search communities"
          hideLabel
          type="search"
          placeholder="Search by name, school or town"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Segmented<LangFilter>
          label="Which communities"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'mine', label: `For ${LANGUAGES[user.lang].name} learners` },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {list.isPending ? (
        <div className="stack-sm" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={56} />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={q ? 'search' : 'users'}
          title={q ? `No communities match “${q}”` : 'Nothing new to join'}
        >
          {q ? (
            'Try the name of your school or town.'
          ) : (
            <>
              You’re in every community that fits. <Link to="/community/create">Start one</Link> for your
              class or study group.
            </>
          )}
        </EmptyState>
      ) : (
        <List label="Communities you can join">
          {list.data.map((c) => (
            <CommunityRow key={c.id} community={c} action={<JoinButton community={c} />} />
          ))}
        </List>
      )}
    </div>
  );
}
