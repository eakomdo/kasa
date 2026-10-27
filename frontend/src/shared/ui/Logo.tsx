import { cn } from '@/shared/lib/misc';

/**
 * Kasa brand mark: a green tile with a woven kente band and a "K".
 * `tone="onDark"` for green or dark backgrounds.
 */
export function LogoMark({
  size = 32,
  className,
  tone = 'default',
}: {
  size?: number;
  className?: string;
  tone?: 'default' | 'onDark';
}) {
  // On green or dark backgrounds the tile turns light so the mark stays visible
  const tile = tone === 'onDark' ? '#FFFFFF' : '#0B5D3F';
  const letter = tone === 'onDark' ? '#0B5D3F' : '#FFFFFF';
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <rect width="64" height="64" rx="15" fill={tile} />
      <g transform="translate(0 50)">
        <rect width="64" height="8" fill="#E3A51B" />
        <rect x="10" width="4" height="8" fill="#161915" />
        <rect x="24" width="8" height="8" fill="#B8361C" />
        <rect x="40" width="4" height="8" fill="#161915" />
        <rect x="50" width="6" height="8" fill="#1F5FA8" />
      </g>
      <path d="M18 12h8v13l12-13h10L34 26.5 49 44H38.5L26 29v15h-8z" fill={letter} />
    </svg>
  );
}

export function Logo({
  size = 32,
  tone = 'default',
  className,
}: {
  size?: number;
  tone?: 'default' | 'onDark';
  className?: string;
}) {
  return (
    <span
      className={cn(className)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32 }}
      aria-label="Kasa"
      role="img"
    >
      <LogoMark size={size} tone={tone} />
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size * 0.82,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: tone === 'onDark' ? 'var(--ink)' : 'var(--ink)',
        }}
      >
        Kasa
      </span>
    </span>
  );
}
