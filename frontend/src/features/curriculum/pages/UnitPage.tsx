import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useUser } from '@/features/auth/session';
import { FREE_OFFLINE_UNITS, useDevicePrefs } from '@/features/settings/devicePrefs';
import { track } from '@/shared/lib/analytics';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { ButtonLink, ErrorState, Notice, PageHeader, Skeleton, Tabs, errorMessage, toast } from '@/shared/ui';
import { saveUnitForOffline, unitTitle, usePhrases, useUnit, useVocabulary } from '../api';
import { MasteryLegend, VocabList } from '../components/VocabList';

export default function UnitPage() {
  const { unitId = '' } = useParams();
  const user = useUser();
  const qc = useQueryClient();
  const unit = useUnit(unitId);
  const words = useVocabulary(unitId);
  const phrases = usePhrases(unitId);
  const [tab, setTab] = useState<'words' | 'phrases'>('words');
  const offlineIds = useDevicePrefs((s) => s.offlineUnitIds);
  const toggleOffline = useDevicePrefs((s) => s.toggleOfflineUnit);
  const [saving, setSaving] = useState(false);
  useDocumentTitle(unit.data ? unitTitle(unit.data) : 'Unit');

  if (unit.error) return <ErrorState error={unit.error} onRetry={() => void unit.refetch()} />;
  const u = unit.data;
  const saved = offlineIds.includes(unitId);
  const hasPhrases = (u?.phraseCount ?? 0) > 0;
  const list = tab === 'phrases' && hasPhrases ? phrases : words;

  const onOffline = async () => {
    if (saved) {
      toggleOffline(unitId);
      toast('Removed from this phone.');
      return;
    }
    if (user.plan === 'free' && offlineIds.length >= FREE_OFFLINE_UNITS) {
      toast(
        `Free accounts can keep ${FREE_OFFLINE_UNITS} units offline. Remove one in Settings, or upgrade to Kasa Plus.`,
      );
      return;
    }
    setSaving(true);
    try {
      await saveUnitForOffline(qc, unitId);
      toggleOffline(unitId);
      toast('Saved. This unit now works without data.');
      track('unit_saved_offline', { unitId });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        backTo="/learn"
        title={
          u ? (
            <span lang={u.titleLocal ? (u.lang === 'twi' ? 'tw' : 'gaa') : undefined}>{unitTitle(u)}</span>
          ) : (
            <Skeleton width={160} height={28} />
          )
        }
        subtitle={u ? [u.titleLocal ? u.titleEn : null, u.strand].filter(Boolean).join(' · ') : undefined}
      />

      <div className="stack" style={{ gap: 32, maxWidth: 'var(--reading-max)' }}>
        {u && <p className="muted">{u.note}</p>}

        <div className="stack-sm">
          <ButtonLink to={`/practice/session?mode=flashcard&unit=${unitId}`} block>
            Practise this unit
          </ButtonLink>
          <div className="row" style={{ justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Link to={`/practice/session?mode=choice&unit=${unitId}`} className="text-button small">
              Quiz me instead
            </Link>
            <button
              type="button"
              className="text-button small"
              onClick={() => void onOffline()}
              disabled={saving}
            >
              {saving ? 'Saving…' : saved ? 'Saved for offline · remove' : 'Save for offline'}
            </button>
          </div>
        </div>

        {u?.contentStatus === 'review' && (
          <Notice tone="warn" title="In review">
            Native-speaking teachers are still checking this unit.
          </Notice>
        )}

        <div className="stack">
          {hasPhrases && (
            <Tabs
              label="Show"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'words', label: `Words · ${u?.wordCount ?? 0}` },
                { value: 'phrases', label: `Phrases · ${u?.phraseCount ?? 0}` },
              ]}
            />
          )}
          {list.isLoading ? (
            <Skeleton height={320} />
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (
            <VocabList items={list.data ?? []} showMastery={tab === 'words'} />
          )}
          {tab === 'words' && <MasteryLegend />}
        </div>
      </div>
    </>
  );
}
