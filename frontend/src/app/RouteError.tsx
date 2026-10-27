import { isRouteErrorResponse, useRouteError } from 'react-router';
import { reportError } from '@/shared/lib/monitoring';
import { Button, ButtonLink, EmptyState } from '@/shared/ui';

/** Catches render errors and failed lazy chunks (common on flaky mobile data). */
export function RouteError() {
  const error = useRouteError();
  const chunkFailed =
    error instanceof Error &&
    /dynamically imported module|Loading chunk|Importing a module script/i.test(error.message);
  if (!chunkFailed) reportError(error, { source: 'route' });
  return (
    <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 16px' }}>
      <EmptyState
        icon={chunkFailed ? 'cloudOff' : 'alert'}
        title={
          chunkFailed
            ? 'This page didn’t download'
            : isRouteErrorResponse(error) && error.status === 404
              ? 'Page not found'
              : 'Something went wrong'
        }
        action={
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <ButtonLink to="/" size="sm" variant="ghost">
              Go home
            </ButtonLink>
          </div>
        }
      >
        {chunkFailed
          ? 'Your connection dropped while Kasa was loading. Reload when you have signal.'
          : 'Kasa hit an error on this screen. Reloading usually fixes it.'}
      </EmptyState>
    </main>
  );
}
