import { Link } from 'react-router';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { IconLink } from '@/shared/ui';
import { DiscoverList } from '../components/DiscoverList';
import styles from '../community.module.css';

export default function DiscoverPage() {
  useDocumentTitle('Discover communities');
  return (
    <div className={styles.page}>
      <header className="stack-sm">
        <IconLink to="/community" icon="back" label="Back to Community" />
        <h1>Discover communities</h1>
        <p className={styles.lede}>Classes, schools, study groups and clubs learning Twi and Ga together.</p>
      </header>
      <DiscoverList />
      <p className={styles.footnote}>
        Can’t find yours? <Link to="/community/create">Start a community</Link>.
      </p>
    </div>
  );
}
