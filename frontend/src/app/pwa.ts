/**
 * Service worker registration and the "install Kasa" prompt.
 * New versions wait for the learner to accept, so an update never wipes a
 * practice session halfway through.
 */
import { useEffect, useState } from 'react';

type UpdateFn = (reload?: boolean) => Promise<void>;
let applyUpdate: UpdateFn | null = null;
let needRefresh = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const updateStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  get: () => needRefresh,
  apply: () => void applyUpdate?.(true),
};

export async function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  applyUpdate = registerSW({
    onNeedRefresh() {
      needRefresh = true;
      emit();
    },
  });
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Returns an install() function when the browser offers "Add to home screen". */
export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  );
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return {
    canInstall: !!event && !installed,
    installed,
    install: async () => {
      if (!event) return;
      await event.prompt();
      setEvent(null);
    },
  };
}
