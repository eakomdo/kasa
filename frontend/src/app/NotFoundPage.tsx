import { useDocumentTitle } from '@/shared/lib/hooks';
import { ButtonLink, EmptyState } from '@/shared/ui';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <EmptyState
      icon="search"
      title="We couldn’t find that page"
      action={
        <ButtonLink to="/" size="sm">
          Back home
        </ButtonLink>
      }
    >
      The link may be old, or the page may have moved.
    </EmptyState>
  );
}
