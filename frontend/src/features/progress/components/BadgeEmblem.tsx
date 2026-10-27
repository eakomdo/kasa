import type { BadgeId } from '@/shared/api/schemas';

const COLORS: Record<BadgeId, string> = {
  akwaaba: 'var(--accent)',
  nnanson: 'var(--accent)',
  sankofa: 'var(--danger)',
  nyansapo: 'var(--info)',
  boafo: 'var(--accent-ink)',
};

/** Simple geometric emblems; a designer should replace these with proper Adinkra-inspired artwork. */
export function BadgeEmblem({ id, earned }: { id: BadgeId; earned: boolean }) {
  const c = earned ? COLORS[id] : 'var(--muted)';
  return (
    <svg viewBox="0 0 40 40" width={40} height={40} aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="40" height="40" rx="12" fill="var(--sunk)" />
      {id === 'akwaaba' && (
        <>
          <circle cx="20" cy="20" r="8" fill="none" stroke={c} strokeWidth="4" />
          <circle cx="20" cy="20" r="2.5" fill={c} />
        </>
      )}
      {id === 'nnanson' && (
        <>
          <path d="M20 6v28M6 20h28" stroke={c} strokeWidth="4" strokeLinecap="round" />
          <circle cx="20" cy="20" r="6" fill={c} />
        </>
      )}
      {id === 'sankofa' && (
        <>
          <path d="M28 14a9 9 0 1 0 0 12" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" />
          <path
            d="M28 9v6h-6"
            fill="none"
            stroke={c}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {id === 'nyansapo' && (
        <path d="M10 10h20v20H10zM15 15h10v10H15z" fill="none" stroke={c} strokeWidth="3.5" />
      )}
      {id === 'boafo' && (
        <path
          d="M12 21l5 5 11-12"
          fill="none"
          stroke={c}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
