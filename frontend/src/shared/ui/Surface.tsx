import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/shared/lib/misc';
import { Icon, type IconName } from './Icon';
import styles from './Surface.module.css';

type CardProps<E extends ElementType> = {
  as?: E;
  tight?: boolean;
  interactive?: boolean;
} & Omit<ComponentPropsWithoutRef<E>, 'as'>;

/** Bordered surface. Use sparingly: only for content that is a separate object. */
export function Card<E extends ElementType = 'section'>({
  as,
  tight,
  interactive,
  className,
  ...rest
}: CardProps<E>) {
  const Tag = (as ?? 'section') as ElementType;
  return (
    <Tag
      className={cn(styles.card, tight && styles.tight, interactive && styles.interactive, className)}
      {...rest}
    />
  );
}

export function Hero({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section className={cn(styles.hero, className)} aria-label={label}>
      <Kente thin flush />
      <div className={styles.heroBody}>{children}</div>
    </section>
  );
}

export function Kente({ thin, flush, className }: { thin?: boolean; flush?: boolean; className?: string }) {
  return (
    <div
      className={cn(styles.kente, thin && styles.kenteThin, flush && styles.kenteFlush, className)}
      aria-hidden="true"
    />
  );
}

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'flame' | 'info';

export function Chip({
  tone = 'neutral',
  icon,
  children,
  className,
  title,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn(styles.chip, tone !== 'neutral' && styles[tone], className)} title={title}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </span>
  );
}

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warn' | 'danger';
  icon?: IconName;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(styles.notice, tone !== 'info' && styles[tone], className)}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <Icon name={icon ?? (tone === 'info' ? 'info' : 'alert')} size={22} />
      <div className={styles.noticeBody}>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  tone = 'forest',
  height,
  className,
}: {
  value: number;
  label: string;
  tone?: 'forest' | 'gold' | 'onHero';
  height?: number;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={cn(
        styles.bar,
        tone === 'gold' && styles.gold,
        tone === 'onHero' && cn(styles.onHero, styles.gold),
        className,
      )}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      style={height ? ({ height } as CSSProperties) : undefined}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.stats, className)}>{children}</div>;
}

export function Stat({ value, label, color }: { value: ReactNode; label: string; color?: string }) {
  return (
    <div className={styles.stat}>
      <b style={color ? { color } : undefined}>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/* ---------- Lists and sections: the default layout for sets of things ---------- */

export function List({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <ul className={cn(styles.list, className)} aria-label={label}>
      {children}
    </ul>
  );
}

interface ListRowProps {
  title: ReactNode;
  meta?: ReactNode;
  start?: ReactNode;
  end?: ReactNode;
  to?: string;
  onClick?: () => void;
  titleLang?: string;
}

/** One line in a List. Renders a link, a button or plain content depending on props. */
export function ListRow({ title, meta, start, end, to, onClick, titleLang }: ListRowProps) {
  const body = (
    <>
      {start}
      <span className={styles.listMain}>
        <span className={styles.listTitle} lang={titleLang}>
          {title}
        </span>
        {meta && <span className={styles.listMeta}>{meta}</span>}
      </span>
      {end && <span className={styles.listEnd}>{end}</span>}
    </>
  );
  return (
    <li>
      {to ? (
        <Link to={to} className={styles.listRow}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" className={styles.listRow} onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className={styles.listRow}>{body}</div>
      )}
    </li>
  );
}

/** A labelled group of content with an optional link on the right ("See all"). */
export function Section({
  label,
  action,
  children,
  className,
}: {
  label: ReactNode;
  action?: { to: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(styles.section, className)}>
      <div className={styles.sectionHead}>
        <h2 className="eyebrow">{label}</h2>
        {action && <Link to={action.to}>{action.label}</Link>}
      </div>
      {children}
    </section>
  );
}
