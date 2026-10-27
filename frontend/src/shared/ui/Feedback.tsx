import type { CSSProperties, ReactNode } from 'react';
import { ApiError } from '@/shared/api/client';
import { cn } from '@/shared/lib/misc';
import { errorMessage, useToasts } from './toast';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import styles from './Feedback.module.css';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className={styles.spinner} role="status" aria-label={label} />;
}

export function PageSpinner() {
  return (
    <div className={styles.center}>
      <Spinner />
    </div>
  );
}

export function Skeleton({
  height = 18,
  width = '100%',
  radius,
  style,
}: {
  height?: number;
  width?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={styles.skeleton}
      style={{ height, width, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <Icon name={icon} size={32} />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const offline = error instanceof ApiError && error.isOffline;
  return (
    <EmptyState
      icon={offline ? 'cloudOff' : 'alert'}
      title={title ?? (offline ? "You're offline" : "That didn't load")}
      action={
        onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {errorMessage(error)}
    </EmptyState>
  );
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className={styles.toasts} role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={cn(styles.toast, t.tone === 'error' && styles.error)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
