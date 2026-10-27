import { Link } from 'react-router';
import type { Unit } from '@/shared/api/schemas';
import { plural } from '@/shared/lib/misc';
import { Card, Chip, ProgressBar } from '@/shared/ui';
import { useDevicePrefs } from '@/features/settings/devicePrefs';
import { unitTitle } from '../api';
import styles from './Curriculum.module.css';

export function UnitCard({ unit }: { unit: Unit }) {
  const offline = useDevicePrefs((s) => s.offlineUnitIds.includes(unit.id));
  const pct = unit.progress.total ? unit.progress.learned / unit.progress.total : 0;
  return (
    <Card as={Link} to={`/learn/${unit.id}`} tight interactive className={styles.unitCard}>
      <span className={styles.unitNumber} aria-hidden="true">
        {unit.order}
      </span>
      <span className={styles.unitBody}>
        <span
          className={styles.unitTitle}
          lang={unit.titleLocal ? (unit.lang === 'twi' ? 'tw' : 'gaa') : undefined}
        >
          {unitTitle(unit)}
        </span>
        {unit.titleLocal && <span className="small">{unit.titleEn}</span>}
        <ProgressBar
          value={pct}
          label={`${Math.round(pct * 100)}% of ${unitTitle(unit)} learned`}
          height={7}
        />
        <span className={styles.unitMeta}>
          <span>
            {unit.strand}
            {offline && ' · Saved offline'}
          </span>
          <span>
            {plural(unit.wordCount, 'word')}
            {unit.phraseCount > 0 && ` · ${plural(unit.phraseCount, 'phrase')}`}
          </span>
        </span>
      </span>
      {unit.contentStatus === 'review' && <Chip tone="warn">In review</Chip>}
    </Card>
  );
}
