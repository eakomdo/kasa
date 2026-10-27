import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/shared/lib/monitoring';

/** Last line of defence for crashes outside the router (providers, startup). */
export class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    reportError(error, { source: 'root', componentStack: info.componentStack });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
        <h1>Kasa needs a restart</h1>
        <p style={{ margin: '12px 0 24px', color: 'var(--muted)' }}>
          Something went wrong while loading. Your progress is saved on your account.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 20px',
            borderRadius: 14,
            border: 0,
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 700,
          }}
        >
          Reload Kasa
        </button>
      </main>
    );
  }
}
