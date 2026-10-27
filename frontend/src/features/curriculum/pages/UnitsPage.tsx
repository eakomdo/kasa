import { useUser } from '@/features/auth/session';
import { PracticeModes } from '@/features/practice/components/PracticeModes';
import { getLanguage } from '@/shared/config/languages';
import { getLevel, levelLabel } from '@/shared/config/levels';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { EmptyState, ErrorState, List, ListRow, Notice, PageHeader, Section, Skeleton } from '@/shared/ui';
import { unitTitle, useUnits } from '../api';
import { useDevicePrefs } from '@/features/settings/devicePrefs';

/** Learn: how to practise, then the units for this class. */
export default function UnitsPage() {
  const user = useUser();
  const level = getLevel(user.levelId);
  const language = getLanguage(user.lang);
  useDocumentTitle('Learn');
  const units = useUnits();
  const offline = useDevicePrefs((s) => s.offlineUnitIds);

  return (
    <div className="stack" style={{ gap: 40, maxWidth: 'var(--reading-max)' }}>
      <PageHeader title="Learn" subtitle={`${language.fullName} · ${levelLabel(level)}`} />

      <Section label="Practise">
        <PracticeModes />
      </Section>

      <Section label={`${level.name} units`}>
        {units.isLoading ? (
          <Skeleton height={240} />
        ) : units.error ? (
          <ErrorState error={units.error} onRetry={() => void units.refetch()} />
        ) : units.data && units.data.length > 0 ? (
          <List>
            {units.data.map((u) => {
              const pct = u.progress.total ? Math.round((u.progress.learned / u.progress.total) * 100) : 0;
              return (
                <ListRow
                  key={u.id}
                  to={`/learn/${u.id}`}
                  start={<span className="unit-number">{u.order}</span>}
                  title={unitTitle(u)}
                  titleLang={u.titleLocal ? (u.lang === 'twi' ? 'tw' : 'gaa') : undefined}
                  meta={[
                    u.titleLocal ? u.titleEn : null,
                    `${u.wordCount} words`,
                    offline.includes(u.id) ? 'Saved offline' : null,
                    u.contentStatus === 'review' ? 'In review' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  end={pct > 0 ? `${pct}%` : undefined}
                />
              );
            })}
          </List>
        ) : (
          <EmptyState title="No units for this class yet">
            Our curriculum team is adding units for {levelLabel(level)}. Try another class in Settings.
          </EmptyState>
        )}
      </Section>

      {language.status === 'review' ? (
        <Notice tone="warn" title={`${language.name} content is in review`}>
          These sample entries are waiting for checks by native-speaking teachers.
        </Notice>
      ) : (
        <p className="small muted">
          {language.name} has extra letters: {language.letters.map((l) => `${l.char} (${l.hint})`).join(', ')}
          .
        </p>
      )}
    </div>
  );
}
