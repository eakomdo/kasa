import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/shared/lib/misc';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

type Variant = 'primary' | 'gold' | 'ghost' | 'danger' | 'subtle';

interface StyleProps {
  variant?: Variant;
  size?: 'md' | 'sm';
  block?: boolean;
  icon?: IconName;
}

const classes = ({ variant = 'primary', size = 'md', block }: StyleProps, extra?: string) =>
  cn(
    styles.button,
    variant !== 'primary' && styles[variant],
    size === 'sm' && styles.sm,
    block && styles.block,
    extra,
  );

interface ButtonProps extends ComponentProps<'button'>, StyleProps {
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  icon,
  loading,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} size={20} />
      )}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps, StyleProps {}

export function ButtonLink({ variant, size, block, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, block }, className)} {...rest}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
}

export function IconButton({ icon, label, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(styles.iconButton, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={20} strokeWidth={2.4} />
    </button>
  );
}

export function IconLink({ icon, label, className, ...rest }: LinkProps & { icon: IconName; label: string }) {
  return (
    <Link className={cn(styles.iconButton, className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={20} strokeWidth={2.4} />
    </Link>
  );
}
