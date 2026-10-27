import { useProgressSummary } from '@/features/progress/api';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { PageHeader, Section } from '@/shared/ui';
import { PracticeModes } from '../components/PracticeModes';

export default function PracticeHubPage() {
  useDocumentTitle('Practise');
  const { data: s } = useProgressSummary();
  return (
    <div className="stack" style={{ gap: 32, maxWidth: 'var(--reading-max)' }}>
      <PageHeader
        title="Practise"
        subtitle={
          s ? `${s.dueCount} words due · ${s.newCount} new` : 'Every mode feeds the same review schedule.'
        }
      />
      <Section label="Choose how">
        <PracticeModes />
      </Section>
      <p className="small muted">
        A word you get right comes back after 1 day, then 3, 7, 14 and 30. Miss it and it comes back in your
        next session.
      </p>
    </div>
  );
}
