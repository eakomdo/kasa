import { useSyncExternalStore } from 'react';
import { Button } from '@/shared/ui';
import { updateStore } from './pwa';

/** Offers a new version without forcing a reload mid-session. */
export function UpdatePrompt() {
  const show = useSyncExternalStore(updateStore.subscribe, updateStore.get);
  if (!show) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        insetInline: 16,
        bottom: 'calc(var(--tabbar-height) + 16px + env(safe-area-inset-bottom, 0px))',
        zIndex: 60,
        maxWidth: 460,
        margin: '0 auto',
        background: 'var(--ink)',
        color: 'var(--paper)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ flex: 1 }}>A new version of Kasa is ready.</span>
      <Button size="sm" variant="gold" onClick={updateStore.apply}>
        Update
      </Button>
    </div>
  );
}
