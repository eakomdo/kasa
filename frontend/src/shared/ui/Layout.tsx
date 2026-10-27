import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/shared/lib/misc';
import { IconButton, IconLink } from './Button';
import styles from './Layout.module.css';

export function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backTo?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      {backTo && <IconLink to={backTo} icon="back" label="Back" />}
      <div className={styles.titles}>
        <h1>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

export function Split({
  children,
  variant = 'default',
  className,
}: {
  children: ReactNode;
  variant?: 'default' | 'even' | 'aside';
  className?: string;
}) {
  return (
    <div className={cn(styles.split, variant !== 'default' && styles[variant], className)}>{children}</div>
  );
}

export function Column({
  children,
  sticky,
  className,
}: {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return <div className={cn('stack', sticky && styles.sticky, className)}>{children}</div>;
}

/** Native <dialog>: focus trap, Esc to close and inert background come for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.dialogInner}>
          <div className={styles.dialogHead}>
            <h2>{title}</h2>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
