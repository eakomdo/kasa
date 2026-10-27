/**
 * Error reporting seam. In production, call setErrorReporter() once at startup
 * with Sentry (or similar). Nothing else in the app needs to change.
 *
 *   import * as Sentry from '@sentry/react';
 *   setErrorReporter((error, context) => Sentry.captureException(error, { extra: context }));
 */
type Reporter = (error: unknown, context?: Record<string, unknown>) => void;

let reporter: Reporter = (error, context) => {
  if (import.meta.env.MODE !== 'test') console.error('[kasa]', error, context ?? '');
};

export function setErrorReporter(next: Reporter) {
  reporter = next;
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  try {
    reporter(error, context);
  } catch {
    /* never let reporting crash the app */
  }
}

/** Catches errors outside React (event handlers, promises) so none are lost. */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, { source: 'window.error' }));
  window.addEventListener('unhandledrejection', (e) =>
    reportError(e.reason, { source: 'unhandledrejection' }),
  );
}
