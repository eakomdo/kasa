// Latin + Latin Extended only: covers English and Twi/Ga letters (ɛ ɔ ŋ) without
// downloading Cyrillic, Greek or Vietnamese subsets learners never need.
import '@fontsource/libre-baskerville/latin-400.css';
import '@fontsource/libre-baskerville/latin-ext-400.css';
import '@fontsource/libre-baskerville/latin-700.css';
import '@fontsource/libre-baskerville/latin-ext-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-ext-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-ext-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/source-sans-3/latin-ext-700.css';
import '@/styles/global.css';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { useSession } from '@/features/auth/session';
import { usePracticeOutbox } from '@/features/practice/outbox';
import { useDevicePrefs } from '@/features/settings/devicePrefs';
import { queryClient, queryPersister } from '@/shared/api/queryClient';
import { Toaster } from '@/shared/ui';
import { prefetchMainScreens } from './prefetch';
import { RootErrorBoundary } from './RootErrorBoundary';
import { createRouter } from './router';

/** Dark is the default look; "system" follows the phone; light is opt-in. */
function useThemeAttribute() {
  const theme = useDevicePrefs((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = theme === 'light' || (theme === 'system' && media.matches);
      root.setAttribute('data-theme', light ? 'light' : 'dark');
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', light ? '#FBFBF9' : '#0D1210');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

/** Sends answers recorded offline as soon as the connection returns. */
function useOutboxSync() {
  const flush = usePracticeOutbox((s) => s.flush);
  const token = useSession((s) => s.token);
  useEffect(() => {
    if (!token) return;
    void flush();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush, token]);
}

export function App() {
  const [router] = useState(createRouter);
  useThemeAttribute();
  useOutboxSync();
  const signedIn = useSession((st) => !!st.token);
  useEffect(() => {
    if (signedIn) prefetchMainScreens();
  }, [signedIn]);
  return (
    <RootErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: 'v1' }}
      >
        <RouterProvider router={router} />
        <Toaster />
      </PersistQueryClientProvider>
    </RootErrorBoundary>
  );
}
