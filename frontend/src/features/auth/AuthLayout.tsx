import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Kente, Logo } from '@/shared/ui';
import styles from './AuthLayout.module.css';

/** Split screen on desktop (brand panel + form); single column on phones. */
export function AuthLayout({
  children,
  showMobileBrand = true,
}: {
  children: ReactNode;
  showMobileBrand?: boolean;
}) {
  return (
    <div className={styles.layout}>
      <aside className={styles.brand}>
        <Link to="/welcome" aria-label="Kasa home">
          <Logo size={40} tone="onDark" />
        </Link>
        <div className="stack">
          <Kente />
          <p className={styles.brandCopy}>
            Twi and Ga for every Ghanaian classroom, from Basic 1 to SHS 3. Built on the GES curriculum, with
            words that come back right before you forget them.
          </p>
        </div>
        <blockquote className={styles.quote}>
          <span lang="tw">Nyansa nni onipa baako ti mu.</span>
          <span>Wisdom is not in one person's head.</span>
        </blockquote>
      </aside>
      <main className={styles.main}>
        {showMobileBrand && (
          <div className={styles.mobileBrand}>
            <Logo size={32} />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

export function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div
      className={styles.stepper}
      role="progressbar"
      aria-label={`Step ${step} of ${total}`}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-on={i < step} />
      ))}
    </div>
  );
}
